import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { CanvasesService } from '../canvases/canvases.service';
import { PlaylistsService } from '../playlists/playlists.service';

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly playlists: PlaylistsService,
    private readonly canvases: CanvasesService,
  ) {}

  private assertPlayerSecret(secret: string | undefined): void {
    const expected = this.config.get<string>(
      'PLAYER_HEARTBEAT_SECRET',
      'dev-player-heartbeat-secret',
    );
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid player credentials');
    }
  }

  /**
   * Initial load + offline recovery: playlist payload, ticker, screen id.
   */
  async getBootstrap(serialNumber: string | undefined, secret: string | undefined) {
    this.assertPlayerSecret(secret);
    if (!serialNumber?.trim()) {
      throw new NotFoundException('serialNumber is required');
    }

    const screen = await this.prisma.screen.findFirst({
      where: { serialNumber: serialNumber.trim() },
      select: {
        id: true,
        serialNumber: true,
        workspaceId: true,
        playerTicker: true,
      },
    });
    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    const playlist = await this.playlists.getPlaylistPayloadForScreen(screen.id);

    return {
      screenId: screen.id,
      serialNumber: screen.serialNumber,
      workspaceId: screen.workspaceId,
      ticker: screen.playerTicker ?? null,
      playlist: playlist ?? {
        workspaceId: screen.workspaceId,
        screenId: screen.id,
        playlistId: null,
        name: null,
        items: [],
      },
    };
  }

  /**
   * Compiled canvas JSON for a screen's workspace (kiosk auth).
   */
  async getCompiledCanvas(
    serialNumber: string | undefined,
    secret: string | undefined,
    canvasId: string,
  ) {
    this.assertPlayerSecret(secret);
    if (!serialNumber?.trim()) {
      throw new NotFoundException('serialNumber is required');
    }

    const screen = await this.prisma.screen.findFirst({
      where: { serialNumber: serialNumber.trim() },
      select: { workspaceId: true },
    });
    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    return this.canvases.getCompiledForPlayer(screen.workspaceId, canvasId);
  }

  /**
   * Dashboard / player dev: load playlist for first screen in a workspace using JWT (Bearer).
   */
  async getBootstrapForAuthenticatedUser(
    user: JwtUser,
    workspaceId: string | undefined,
    workspaceName: string | undefined,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, isSuperAdmin: true },
    });
    if (!dbUser) throw new UnauthorizedException();

    let ws = null as { id: string } | null;
    if (workspaceId?.trim()) {
      ws = await this.prisma.workspace.findFirst({
        where: { id: workspaceId.trim() },
        select: { id: true },
      });
    } else if (workspaceName?.trim()) {
      ws = await this.prisma.workspace.findFirst({
        where: { name: workspaceName.trim() },
        select: { id: true },
      });
    } else {
      ws = await this.prisma.workspace.findFirst({
        where: { name: 'Admin Control' },
        select: { id: true },
      });
    }
    if (!ws) throw new NotFoundException('Workspace not found');

    if (!dbUser.isSuperAdmin) {
      const m = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: ws.id, userId: user.sub },
        },
      });
      if (!m) throw new ForbiddenException('No access to this workspace');
    }

    const screen = await this.prisma.screen.findFirst({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        serialNumber: true,
        workspaceId: true,
        playerTicker: true,
      },
    });
    if (!screen) throw new NotFoundException('No screen in workspace');

    const playlist = await this.playlists.getPlaylistPayloadForScreen(screen.id);

    return {
      screenId: screen.id,
      serialNumber: screen.serialNumber,
      workspaceId: screen.workspaceId,
      ticker: screen.playerTicker ?? null,
      playlist: playlist ?? {
        workspaceId: screen.workspaceId,
        screenId: screen.id,
        playlistId: null,
        name: null,
        items: [],
      },
    };
  }
}
