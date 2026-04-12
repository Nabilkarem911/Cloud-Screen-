import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ScreenPairingSessionStatus, ScreenStatus } from '@prisma/client';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import cookie from 'cookie';
import type { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScreenHeartbeatService } from './screen-heartbeat.service';

type ScreenRegisterPayload = {
  serialNumber: string;
  secret: string;
};

type DashboardSubscribePayload = {
  workspaceId: string;
};

type PairingWatchPayload = {
  sessionId: string;
  pollSecret: string;
};

type JwtAccessPayload = {
  sub: string;
  email: string;
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = process.env.FRONTEND_ORIGINS?.split(',').map((s) =>
        s.trim(),
      ) ?? ['http://localhost:3000', 'http://localhost:3001'];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly heartbeat: ScreenHeartbeatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.heartbeat.setServer(this.server);
  }

  handleConnection(client: Socket): void {
    client.emit('connected', { message: 'Realtime channel connected' });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const binding = this.heartbeat.getBinding(client.id);
    this.heartbeat.unbindSocket(client.id);

    if (binding) {
      await this.prisma.screen.update({
        where: { id: binding.screenId },
        data: { status: ScreenStatus.OFFLINE, isOfflineCacheMode: false },
      });
      this.heartbeat.emitScreenStatus(binding.workspaceId, {
        screenId: binding.screenId,
        serialNumber: binding.serialNumber,
        status: ScreenStatus.OFFLINE,
        lastSeenAt: new Date().toISOString(),
        isOfflineCacheMode: false,
      });
    }
  }

  /**
   * JWT / dashboard-token players: join `screen:{id}` to receive `player:ticker`
   * and other screen-targeted events without kiosk `screen:register`.
   */
  @SubscribeMessage('player:bind_screen')
  async handlePlayerBindScreen(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenId?: string },
  ): Promise<void> {
    const user = this.parseUserFromSocket(client);
    if (!user) {
      client.emit('screen:error', { code: 'UNAUTHORIZED' });
      return;
    }
    const screenId =
      typeof body?.screenId === 'string' ? body.screenId.trim() : '';
    if (!screenId) {
      client.emit('screen:error', { code: 'VALIDATION' });
      return;
    }
    const screen = await this.prisma.screen.findFirst({
      where: { id: screenId },
      select: { id: true, workspaceId: true },
    });
    if (!screen) {
      client.emit('screen:error', { code: 'SCREEN_NOT_FOUND' });
      return;
    }
    const [actor, membership] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { isSuperAdmin: true },
      }),
      this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: screen.workspaceId,
            userId: user.sub,
          },
        },
        select: { userId: true },
      }),
    ]);
    const allowed = Boolean(actor?.isSuperAdmin || membership);
    if (!allowed) {
      client.emit('screen:error', { code: 'FORBIDDEN_BIND' });
      return;
    }
    await client.join(`screen:${screen.id}`);
    client.emit('player:bound', { screenId: screen.id });
  }

  @SubscribeMessage('screen:register')
  async handleScreenRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ScreenRegisterPayload,
  ): Promise<void> {
    const expected = this.configService.get<string>(
      'PLAYER_HEARTBEAT_SECRET',
      'dev-player-heartbeat-secret',
    );
    if (!payload?.serialNumber || payload.secret !== expected) {
      client.emit('screen:error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
      return;
    }

    const screen = await this.prisma.screen.findFirst({
      where: { serialNumber: payload.serialNumber },
      select: {
        id: true,
        workspaceId: true,
        serialNumber: true,
        playerTicker: true,
      },
    });

    if (!screen) {
      client.emit('screen:error', { code: 'SCREEN_NOT_FOUND' });
      return;
    }

    this.heartbeat.bindPlayerSocket(client, {
      screenId: screen.id,
      workspaceId: screen.workspaceId,
      serialNumber: screen.serialNumber,
    });

    const now = new Date();
    await this.prisma.screen.update({
      where: { id: screen.id },
      data: {
        status: ScreenStatus.ONLINE,
        lastSeenAt: now,
        isOfflineCacheMode: false,
      },
    });

    this.heartbeat.emitScreenStatus(screen.workspaceId, {
      screenId: screen.id,
      serialNumber: screen.serialNumber,
      status: ScreenStatus.ONLINE,
      lastSeenAt: now.toISOString(),
      isOfflineCacheMode: false,
    });

    await client.join(`screen:${screen.id}`);

    client.emit('screen:registered', {
      screenId: screen.id,
      ticker: screen.playerTicker ?? null,
    });
  }

  /**
   * Player-reported playback / asset failures (distinct from server-emitted
   * `screen:error` registration failures).
   */
  @SubscribeMessage('screen:error')
  handleScreenClientErrorReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): void {
    const binding = this.heartbeat.getBinding(client.id);
    if (!binding) return;
    const meta =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    this.log.warn(
      `screen playback error screenId=${binding.screenId} serial=${binding.serialNumber} workspaceId=${binding.workspaceId} meta=${JSON.stringify(meta)}`,
    );
  }

  @SubscribeMessage('screen:heartbeat')
  async handleScreenHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body?: { isOfflineMode?: boolean },
  ): Promise<void> {
    const ok = this.heartbeat.touchHeartbeat(client.id);
    if (!ok) {
      client.emit('screen:error', { code: 'NOT_REGISTERED' });
      return;
    }
    const isOfflineMode =
      body &&
      typeof body === 'object' &&
      typeof (body as { isOfflineMode?: unknown }).isOfflineMode === 'boolean'
        ? (body as { isOfflineMode: boolean }).isOfflineMode
        : false;
    await this.heartbeat.applyHeartbeatFromSocket(client.id, {
      isOfflineMode,
    });
  }

  /** Legacy ping — treated as heartbeat for players already registered. */
  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket): Promise<void> {
    if (this.heartbeat.getBinding(client.id)) {
      await this.handleScreenHeartbeat(client, undefined);
    } else {
      client.emit('pong', { at: new Date().toISOString() });
    }
  }

  /** Unauthenticated: join `pairing:{sessionId}` after validating poll secret (player TV / kiosk). */
  @SubscribeMessage('pairing:watch')
  async handlePairingWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PairingWatchPayload,
  ): Promise<void> {
    const sessionId = payload?.sessionId?.trim();
    const pollSecret = payload?.pollSecret?.trim();
    if (!sessionId || !pollSecret) {
      client.emit('pairing:error', { code: 'VALIDATION' });
      return;
    }
    const row = await this.prisma.screenPairingSession.findFirst({
      where: {
        id: sessionId,
        pollSecret,
        status: ScreenPairingSessionStatus.PENDING,
      },
      select: { id: true, expiresAt: true },
    });
    if (!row || row.expiresAt < new Date()) {
      client.emit('pairing:error', { code: 'NOT_FOUND_OR_EXPIRED' });
      return;
    }
    await client.join(`pairing:${row.id}`);
    client.emit('pairing:watching', { sessionId: row.id });
  }

  @SubscribeMessage('dashboard:subscribe')
  async handleDashboardSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DashboardSubscribePayload,
  ): Promise<void> {
    const user = this.parseUserFromSocket(client);
    if (!user) {
      client.emit('dashboard:error', { code: 'UNAUTHORIZED' });
      return;
    }

    if (!payload?.workspaceId) {
      client.emit('dashboard:error', { code: 'WORKSPACE_REQUIRED' });
      return;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: payload.workspaceId,
          userId: user.sub,
        },
      },
    });

    if (!membership) {
      const u = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { isSuperAdmin: true },
      });
      if (!u?.isSuperAdmin) {
        client.emit('dashboard:error', { code: 'FORBIDDEN' });
        return;
      }
    }

    await client.join(`workspace:${payload.workspaceId}`);
    client.emit('dashboard:subscribed', { workspaceId: payload.workspaceId });
  }

  private parseUserFromSocket(client: Socket): JwtAccessPayload | null {
    const secret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'dev-access-secret',
    );
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      try {
        return this.jwtService.verify<JwtAccessPayload>(authToken, { secret });
      } catch {
        return null;
      }
    }
    const raw = client.handshake.headers.cookie;
    if (!raw) return null;
    const parsed = cookie.parse(raw);
    const token = parsed.cs_access_token;
    if (!token) return null;
    try {
      return this.jwtService.verify<JwtAccessPayload>(token, { secret });
    } catch {
      return null;
    }
  }
}
