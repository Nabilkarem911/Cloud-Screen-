import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScreenStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';
import { SchedulingService } from '../schedules/scheduling.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { ListScreensDto } from './dto/list-screens.dto';
import { OverrideScreenDto } from './dto/override-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { RemoteCommandDto } from './dto/remote-command.dto';

@Injectable()
export class ScreensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playlistsService: PlaylistsService,
    private readonly heartbeat: ScreenHeartbeatService,
    private readonly scheduling: SchedulingService,
  ) {}

  async create(dto: CreateScreenDto) {
    let playlistGroupId: string | null | undefined = dto.playlistGroupId ?? undefined;
    if (playlistGroupId === '') playlistGroupId = null;
    if (playlistGroupId) {
      const pl = await this.prisma.playlist.findFirst({
        where: { id: playlistGroupId, workspaceId: dto.workspaceId },
      });
      if (!pl) throw new BadRequestException('Playlist not found in workspace');
    }

    return this.prisma.screen.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        serialNumber: dto.serialNumber,
        location: dto.location,
        status: ScreenStatus.OFFLINE,
        ...(playlistGroupId !== undefined ? { playlistGroupId } : {}),
      },
      select: this.screenSelect,
    });
  }

  async list(dto: ListScreensDto) {
    const groupFilter: Prisma.ScreenWhereInput = {};
    if (dto.ungrouped) {
      groupFilter.playlistGroupId = null;
    } else if (dto.playlistGroupId) {
      groupFilter.playlistGroupId = dto.playlistGroupId;
    }

    const where: Prisma.ScreenWhereInput = {
      workspaceId: dto.workspaceId,
      ...(dto.status ? { status: dto.status } : {}),
      ...groupFilter,
    };
    const skip = (dto.page - 1) * dto.limit;

    const [items, total] = await Promise.all([
      this.prisma.screen.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: dto.limit,
        select: this.screenSelect,
      }),
      this.prisma.screen.count({ where }),
    ]);

    return {
      items,
      page: dto.page,
      limit: dto.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / dto.limit)),
    };
  }

  async getById(workspaceId: string, id: string) {
    const screen = await this.prisma.screen.findFirst({
      where: { id, workspaceId },
      select: this.screenSelect,
    });
    if (!screen) throw new NotFoundException('Screen not found');
    return screen;
  }

  async getActiveContent(workspaceId: string, screenId: string) {
    await this.getById(workspaceId, screenId);
    const resolved = await this.scheduling.resolveEffectivePlaylistId(
      screenId,
      new Date(),
    );
    const playlist =
      await this.playlistsService.getPlaylistPayloadForScreen(screenId);
    return {
      effectivePlaylistId: resolved.playlistId,
      source: resolved.source,
      playlist,
    };
  }

  async setPlaylistOverride(
    workspaceId: string,
    screenId: string,
    dto: OverrideScreenDto,
  ) {
    await this.getById(workspaceId, screenId);
    const durationMin = dto.durationMinutes ?? 480;
    let overridePlaylistId: string | null = null;
    let overrideExpiresAt: Date | null = null;

    if (dto.playlistId === null || dto.playlistId === '') {
      overridePlaylistId = null;
      overrideExpiresAt = null;
    } else if (dto.playlistId) {
      const pl = await this.prisma.playlist.findFirst({
        where: { id: dto.playlistId, workspaceId },
      });
      if (!pl) throw new BadRequestException('Playlist not found in workspace');
      overridePlaylistId = dto.playlistId;
      overrideExpiresAt = new Date(Date.now() + durationMin * 60_000);
    } else {
      throw new BadRequestException('playlistId is required, or pass null to clear');
    }

    const updated = await this.prisma.screen.update({
      where: { id: screenId },
      data: { overridePlaylistId, overrideExpiresAt },
      select: this.screenSelect,
    });

    await this.playlistsService.emitPlaylistForScreen(screenId);
    return updated;
  }

  async update(workspaceId: string, id: string, dto: UpdateScreenDto) {
    await this.getById(workspaceId, id);
    if (dto.playlistGroupId !== undefined) {
      if (dto.playlistGroupId === null || dto.playlistGroupId === '') {
        /* clear */
      } else {
        const pl = await this.prisma.playlist.findFirst({
          where: { id: dto.playlistGroupId, workspaceId },
        });
        if (!pl) throw new BadRequestException('Playlist not found in workspace');
      }
    }

    const updated = await this.prisma.screen.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.activePlaylistId !== undefined
          ? { activePlaylistId: dto.activePlaylistId || null }
          : {}),
        ...(dto.playerTicker !== undefined
          ? { playerTicker: dto.playerTicker }
          : {}),
        ...(dto.playlistGroupId !== undefined
          ? {
              playlistGroupId:
                dto.playlistGroupId && dto.playlistGroupId !== ''
                  ? dto.playlistGroupId
                  : null,
            }
          : {}),
      },
      select: this.screenSelect,
    });
    if (dto.activePlaylistId !== undefined) {
      await this.playlistsService.emitPlaylistForScreen(id);
    }
    if (dto.playerTicker !== undefined) {
      this.heartbeat.emitPlayerTicker(id, dto.playerTicker ?? null);
    }
    return updated;
  }

  async sendRemoteCommand(
    workspaceId: string,
    screenId: string,
    dto: RemoteCommandDto,
  ) {
    const screen = await this.prisma.screen.findFirst({
      where: { id: screenId, workspaceId },
      select: { id: true, serialNumber: true },
    });
    if (!screen) throw new NotFoundException('Screen not found');

    const base = { command: dto.command, screenId: screen.id, at: new Date().toISOString() };

    if (dto.command === 'identify') {
      this.heartbeat.emitRemoteCommand(screen.id, {
        ...base,
        serialNumber: screen.serialNumber,
      });
      return { ok: true, command: dto.command };
    }

    if (dto.command === 'refresh_content') {
      this.heartbeat.emitRemoteCommand(screen.id, base);
      return { ok: true, command: dto.command };
    }

    if (dto.command === 'restart') {
      this.heartbeat.emitRemoteCommand(screen.id, base);
      return { ok: true, command: dto.command };
    }

    return { ok: false };
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    await this.getById(workspaceId, id);
    await this.prisma.screen.delete({ where: { id } });
  }

  private readonly screenSelect = {
    id: true,
    workspaceId: true,
    name: true,
    serialNumber: true,
    status: true,
    location: true,
    lastSeenAt: true,
    playlistGroupId: true,
    playlistGroup: {
      select: { id: true, name: true },
    },
    activePlaylistId: true,
    activePlaylist: {
      select: { id: true, name: true },
    },
    overridePlaylistId: true,
    overrideExpiresAt: true,
    playerTicker: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.ScreenSelect;
}
