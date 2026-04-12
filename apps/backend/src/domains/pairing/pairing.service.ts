import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlayerPlatform,
  Prisma,
  ScreenPairingSessionStatus,
  ScreenStatus,
  UserRole,
} from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';
import { ClaimPairingSessionDto } from './dto/claim-pairing-session.dto';
import { StartPairingSessionDto } from './dto/start-pairing-session.dto';

@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly heartbeat: ScreenHeartbeatService,
  ) {}

  private pairingTtlMs(): number {
    const raw = this.config.get<string>('PAIRING_SESSION_TTL_MS', '900000');
    const n = Number(raw);
    return Number.isFinite(n) && n > 60_000 && n < 86_400_000 ? n : 900_000;
  }

  private async assertWorkspaceAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (user?.isSuperAdmin) return;
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Workspace not found');
    if (membership.role !== UserRole.OWNER && membership.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only owners and admins can claim a pairing code',
      );
    }
  }

  private async assertWithinScreenLimitTx(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ): Promise<void> {
    const sub = await tx.subscription.findUnique({
      where: { workspaceId },
      select: { screenLimit: true },
    });
    const limit = sub?.screenLimit ?? 25;
    const count = await tx.screen.count({ where: { workspaceId } });
    if (count >= limit) {
      throw new BadRequestException('LIMIT_REACHED');
    }
  }

  private makeSixDigitCode(): string {
    return String(randomInt(100_000, 1_000_000));
  }

  private makePollSecret(): string {
    return randomBytes(24).toString('base64url');
  }

  private async makeUniqueSerialTx(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let i = 0; i < 24; i += 1) {
      const serial = `CS-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
      const exists = await tx.screen.findUnique({
        where: { serialNumber: serial },
        select: { id: true },
      });
      if (!exists) return serial;
    }
    throw new BadRequestException('Could not allocate serial number');
  }

  async startSession(dto: StartPairingSessionDto, secretHeader?: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.pairingTtlMs());
    const playerPlatform = dto.playerPlatform ?? PlayerPlatform.WEB;
    const resolutionWidth = dto.resolutionWidth ?? 1920;
    const resolutionHeight = dto.resolutionHeight ?? 1080;

    const notifyWorkspaceId = dto.workspaceId?.trim();
    if (notifyWorkspaceId) {
      const expected = this.config.get<string>(
        'PLAYER_HEARTBEAT_SECRET',
        'dev-player-heartbeat-secret',
      );
      if (!secretHeader || secretHeader !== expected) {
        throw new UnauthorizedException(
          'x-player-secret required when workspaceId is set',
        );
      }
      const ws = await this.prisma.workspace.findUnique({
        where: { id: notifyWorkspaceId },
        select: { id: true },
      });
      if (!ws) {
        throw new BadRequestException('Unknown workspaceId for pairing notify');
      }
    }

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const code = this.makeSixDigitCode();
      const pollSecret = this.makePollSecret();
      try {
        const row = await this.prisma.screenPairingSession.create({
          data: {
            code,
            pollSecret,
            status: ScreenPairingSessionStatus.PENDING,
            expiresAt,
            playerPlatform,
            resolutionWidth,
            resolutionHeight,
          },
          select: {
            id: true,
            code: true,
            pollSecret: true,
            expiresAt: true,
          },
        });
        if (notifyWorkspaceId) {
          this.heartbeat.emitPairingStarted(notifyWorkspaceId, {
            sessionId: row.id,
            expiresAt: row.expiresAt.toISOString(),
            source: 'player',
            at: now.toISOString(),
          });
        }
        return {
          sessionId: row.id,
          pairingCode: row.code,
          pollSecret: row.pollSecret,
          expiresAt: row.expiresAt.toISOString(),
        };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate pairing code');
  }

  async pollSession(sessionId: string, pollSecret: string | undefined) {
    if (!pollSecret?.trim()) {
      throw new NotFoundException('Session not found');
    }
    const row = await this.prisma.screenPairingSession.findFirst({
      where: { id: sessionId, pollSecret: pollSecret.trim() },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        screenId: true,
        workspaceId: true,
        screen: {
          select: { serialNumber: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Session not found');

    const now = new Date();
    if (
      row.status === ScreenPairingSessionStatus.PENDING &&
      row.expiresAt < now
    ) {
      await this.prisma.screenPairingSession.updateMany({
        where: {
          id: row.id,
          status: ScreenPairingSessionStatus.PENDING,
        },
        data: { status: ScreenPairingSessionStatus.EXPIRED },
      });
      return {
        status: 'expired' as const,
        expiresAt: row.expiresAt.toISOString(),
      };
    }

    if (row.status === ScreenPairingSessionStatus.COMPLETE && row.screen) {
      return {
        status: 'complete' as const,
        screenId: row.screenId,
        workspaceId: row.workspaceId,
        serialNumber: row.screen.serialNumber,
      };
    }

    if (row.status !== ScreenPairingSessionStatus.PENDING) {
      return {
        status: row.status.toLowerCase() as 'expired' | 'cancelled',
        expiresAt: row.expiresAt.toISOString(),
      };
    }

    return {
      status: 'pending' as const,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async claimSession(
    workspaceId: string,
    userId: string,
    dto: ClaimPairingSessionDto,
  ) {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    const code = dto.code.trim();
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.screenPairingSession.findFirst({
        where: {
          code,
          status: ScreenPairingSessionStatus.PENDING,
          expiresAt: { gt: now },
        },
      });
      if (!session) {
        throw new BadRequestException('INVALID_OR_EXPIRED_PAIRING_CODE');
      }

      await this.assertWithinScreenLimitTx(tx, workspaceId);

      const serialNumber = await this.makeUniqueSerialTx(tx);
      const screenName =
        dto.name?.trim() ||
        `Screen ${serialNumber.slice(-6).toUpperCase()}`;

      const screen = await tx.screen.create({
        data: {
          workspaceId,
          name: screenName,
          serialNumber,
          status: ScreenStatus.OFFLINE,
          playerPlatform: session.playerPlatform,
          resolutionWidth: session.resolutionWidth,
          resolutionHeight: session.resolutionHeight,
        },
        select: {
          id: true,
          serialNumber: true,
          name: true,
          playerPlatform: true,
          resolutionWidth: true,
          resolutionHeight: true,
        },
      });

      await tx.screenPairingSession.update({
        where: { id: session.id },
        data: {
          status: ScreenPairingSessionStatus.COMPLETE,
          workspaceId,
          screenId: screen.id,
        },
      });

      return { session, screen };
    });

    const { session, screen } = result;
    this.heartbeat.emitPairingSessionComplete(session.id, {
      sessionId: session.id,
      screenId: screen.id,
      serialNumber: screen.serialNumber,
      workspaceId,
      playerPlatform: screen.playerPlatform,
      resolutionWidth: screen.resolutionWidth,
      resolutionHeight: screen.resolutionHeight,
      at: new Date().toISOString(),
    });

    return {
      workspaceId,
      sessionId: session.id,
      screen,
    };
  }
}
