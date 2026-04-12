import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScreenStatus } from '@prisma/client';
import type { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { PrismaService } from '../../common/prisma/prisma.service';

type SocketBinding = {
  screenId: string;
  workspaceId: string;
  serialNumber: string;
  lastPingAt: number;
};

@Injectable()
export class ScreenHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScreenHeartbeatService.name);
  private io: Server | null = null;
  private readonly socketBindings = new Map<string, SocketBinding>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  setServer(server: Server): void {
    this.io = server;
  }

  /** All Socket.IO client connections on the /realtime namespace (players + dashboards). */
  getConnectedSocketCount(): number {
    if (!this.io) return 0;
    return this.io.sockets?.sockets?.size ?? 0;
  }

  onModuleInit(): void {
    const intervalMs = Number(
      this.configService.get<string>('HEARTBEAT_SWEEP_MS', '10000'),
    );
    this.sweepTimer = setInterval(() => {
      void this.sweepStaleScreens();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  bindPlayerSocket(
    client: Socket,
    binding: Omit<SocketBinding, 'lastPingAt'>,
  ): void {
    this.socketBindings.set(client.id, {
      ...binding,
      lastPingAt: Date.now(),
    });
  }

  unbindSocket(clientId: string): void {
    this.socketBindings.delete(clientId);
  }

  getBinding(clientId: string): SocketBinding | undefined {
    return this.socketBindings.get(clientId);
  }

  touchHeartbeat(clientId: string): boolean {
    const row = this.socketBindings.get(clientId);
    if (!row) return false;
    row.lastPingAt = Date.now();
    return true;
  }

  async applyHeartbeatFromSocket(
    clientId: string,
    opts?: { isOfflineMode?: boolean },
  ): Promise<void> {
    const binding = this.socketBindings.get(clientId);
    if (!binding) return;

    binding.lastPingAt = Date.now();
    const now = new Date();
    const offlineCache = Boolean(opts?.isOfflineMode);

    await this.prisma.screen.update({
      where: { id: binding.screenId },
      data: {
        status: ScreenStatus.ONLINE,
        lastSeenAt: now,
        isOfflineCacheMode: offlineCache,
      },
    });

    this.emitScreenStatus(binding.workspaceId, {
      screenId: binding.screenId,
      serialNumber: binding.serialNumber,
      status: ScreenStatus.ONLINE,
      lastSeenAt: now.toISOString(),
      isOfflineCacheMode: offlineCache,
    });
  }

  private async sweepStaleScreens(): Promise<void> {
    const staleMs = Number(
      this.configService.get<string>('HEARTBEAT_STALE_MS', '45000'),
    );
    const now = Date.now();
    const staleIds: string[] = [];

    for (const [socketId, row] of this.socketBindings.entries()) {
      if (now - row.lastPingAt > staleMs) {
        staleIds.push(socketId);
      }
    }

    for (const socketId of staleIds) {
      const row = this.socketBindings.get(socketId);
      if (!row) continue;
      this.socketBindings.delete(socketId);

      await this.prisma.screen.update({
        where: { id: row.screenId },
        data: { status: ScreenStatus.OFFLINE, isOfflineCacheMode: false },
      });

      this.emitScreenStatus(row.workspaceId, {
        screenId: row.screenId,
        serialNumber: row.serialNumber,
        status: ScreenStatus.OFFLINE,
        lastSeenAt: new Date().toISOString(),
        isOfflineCacheMode: false,
      });

      void this.io?.in(socketId).disconnectSockets(true);

      this.logger.warn(
        `Screen ${row.serialNumber} marked OFFLINE (heartbeat stale).`,
      );
    }
  }

  emitScreenStatus(
    workspaceId: string,
    payload: {
      screenId: string;
      serialNumber: string;
      status: ScreenStatus;
      lastSeenAt: string;
      isOfflineCacheMode: boolean;
    },
  ): void {
    this.io?.to(`workspace:${workspaceId}`).emit('screen:status', payload);
  }

  emitPairingStarted(
    workspaceId: string,
    payload: Record<string, unknown>,
  ): void {
    this.io?.to(`workspace:${workspaceId}`).emit('pairing:started', payload);
  }

  emitContentSync(screenId: string, payload: Record<string, unknown>): void {
    this.io?.to(`screen:${screenId}`).emit('content:sync', payload);
  }

  emitWorkspaceSubscriptionUpdated(
    workspaceId: string,
    payload: Record<string, unknown>,
  ): void {
    this.io?.to(`workspace:${workspaceId}`).emit('workspace:subscription', payload);
  }

  emitScheduleChanged(
    screenId: string,
    payload: Record<string, unknown>,
  ): void {
    this.io?.to(`screen:${screenId}`).emit('schedule:changed', {
      screenId,
      at: new Date().toISOString(),
      playlist: payload,
    });
  }

  emitRemoteCommand(screenId: string, payload: Record<string, unknown>): void {
    this.io?.to(`screen:${screenId}`).emit('remote:command', payload);
  }

  emitPlayerTicker(screenId: string, text: string | null): void {
    this.io?.to(`screen:${screenId}`).emit('player:ticker', {
      text,
      at: new Date().toISOString(),
    });
  }

  /** Live canvas layout push for players showing this design */
  emitCanvasLive(screenId: string, payload: Record<string, unknown>): void {
    this.io?.to(`screen:${screenId}`).emit('canvas:live', payload);
  }

  /** Player apps can join `pairing:{sessionId}` to receive credentials when the dashboard claims the code. */
  emitPairingSessionComplete(
    sessionId: string,
    payload: Record<string, unknown>,
  ): void {
    this.io?.to(`pairing:${sessionId}`).emit('pairing:complete', payload);
  }
}
