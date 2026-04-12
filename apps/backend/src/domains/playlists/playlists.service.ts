import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';

import { MediaService } from '../media/media.service';

import { CanvasesService } from '../canvases/canvases.service';

import { SchedulingService } from '../schedules/scheduling.service';

import type { Playlist, PlaylistItem, Media, Canvas } from '@prisma/client';

import type { ReplacePlaylistItemsDto } from './dto/replace-playlist-items.dto';
import type { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly heartbeat: ScreenHeartbeatService,

    private readonly mediaService: MediaService,

    private readonly canvasesService: CanvasesService,

    private readonly scheduling: SchedulingService,
  ) {}

  async create(workspaceId: string, name: string) {
    return this.prisma.playlist.create({
      data: { workspaceId, name },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.playlist.findMany({
      where: { workspaceId },

      orderBy: { updatedAt: 'desc' },

      include: {
        _count: { select: { items: true, screensInGroup: true } },
      },
    });
  }

  async getOne(workspaceId: string, id: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id, workspaceId },

      include: {
        items: {
          orderBy: { orderIndex: 'asc' },

          include: { media: true, canvas: true },
        },
      },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');

    return this.serializePlaylist(playlist);
  }

  async update(workspaceId: string, id: string, dto: UpdatePlaylistDto) {
    await this.ensurePlaylist(workspaceId, id);
    if (dto.name === undefined && dto.isPublished === undefined) {
      throw new BadRequestException('No fields to update.');
    }
    const data: { name?: string; isPublished?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    return this.prisma.playlist.update({
      where: { id },
      data,
    });
  }

  async replaceItems(
    workspaceId: string,

    playlistId: string,

    dto: ReplacePlaylistItemsDto,
  ) {
    await this.ensurePlaylist(workspaceId, playlistId);

    for (const item of dto.items) {
      const hasMedia = !!item.mediaId?.trim();

      const hasCanvas = !!item.canvasId?.trim();

      if (hasMedia === hasCanvas) {
        throw new BadRequestException(
          'Each playlist item must have exactly one of mediaId or canvasId.',
        );
      }
    }

    const mediaIds = [
      ...new Set(
        dto.items.map((i) => i.mediaId).filter((x): x is string => !!x?.trim()),
      ),
    ];

    const canvasIds = [
      ...new Set(
        dto.items
          .map((i) => i.canvasId)
          .filter((x): x is string => !!x?.trim()),
      ),
    ];

    if (mediaIds.length > 0) {
      const count = await this.prisma.media.count({
        where: { workspaceId, id: { in: mediaIds } },
      });

      if (count !== mediaIds.length) {
        throw new BadRequestException(
          'One or more media items are missing or not in this workspace.',
        );
      }
    }

    if (canvasIds.length > 0) {
      const count = await this.prisma.canvas.count({
        where: { workspaceId, id: { in: canvasIds } },
      });

      if (count !== canvasIds.length) {
        throw new BadRequestException(
          'One or more canvas designs are missing or not in this workspace.',
        );
      }
    }

    const orderIndices = dto.items.map((i) => i.orderIndex);

    if (new Set(orderIndices).size !== orderIndices.length) {
      throw new BadRequestException('Duplicate orderIndex values.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.playlistItem.deleteMany({ where: { playlistId } });

      if (dto.items.length > 0) {
        await tx.playlistItem.createMany({
          data: dto.items.map((item) => ({
            playlistId,

            mediaId: item.mediaId?.trim() || null,

            canvasId: item.canvasId?.trim() || null,

            orderIndex: item.orderIndex,

            durationSec: item.durationSec,
          })),
        });
      }
    });

    await this.emitForPlaylist(playlistId);

    return this.getOne(workspaceId, playlistId);
  }

  async remove(
    workspaceId: string,
    id: string,
    options?: { force?: boolean },
  ): Promise<void> {
    await this.ensurePlaylist(workspaceId, id);

    if (!options?.force) {
      const used = await this.prisma.screen.count({
        where: { activePlaylistId: id },
      });

      if (used > 0) {
        throw new BadRequestException(
          'Playlist is assigned to one or more screens. Unassign it first, or delete with force=true (owner/admin only).',
        );
      }

      const inSchedules = await this.prisma.schedule.count({
        where: { playlistId: id },
      });

      if (inSchedules > 0) {
        throw new BadRequestException(
          'Playlist is referenced by schedules. Remove those schedules first, or delete with force=true (owner/admin only).',
        );
      }

      await this.prisma.playlist.delete({ where: { id } });
      return;
    }

    const directScreens = await this.prisma.screen.findMany({
      where: {
        workspaceId,
        OR: [
          { activePlaylistId: id },
          { overridePlaylistId: id },
          { playlistGroupId: id },
        ],
      },
      select: { id: true },
    });
    const screenIdSet = new Set(directScreens.map((s) => s.id));

    const workspaceWideSchedules = await this.prisma.schedule.count({
      where: { playlistId: id, screenId: null, enabled: true },
    });
    if (workspaceWideSchedules > 0) {
      const allInWs = await this.prisma.screen.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      for (const s of allInWs) screenIdSet.add(s.id);
    }

    await this.prisma.playlist.delete({ where: { id } });

    for (const screenId of screenIdSet) {
      await this.emitPlaylistForScreen(screenId);
    }
  }

  /** Same-workspace copy: reuses media/canvas IDs. */
  async duplicateInWorkspace(workspaceId: string, playlistId: string) {
    await this.ensurePlaylist(workspaceId, playlistId);
    const pl = await this.prisma.playlist.findFirst({
      where: { id: playlistId, workspaceId },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!pl) throw new NotFoundException('Playlist not found');

    const created = await this.prisma.$transaction(async (tx) => {
      const nu = await tx.playlist.create({
        data: {
          workspaceId,
          name: this.makeDuplicatePlaylistName(pl.name),
          isPublished: false,
        },
      });
      if (pl.items.length > 0) {
        await tx.playlistItem.createMany({
          data: pl.items.map((item) => ({
            playlistId: nu.id,
            mediaId: item.mediaId,
            canvasId: item.canvasId,
            orderIndex: item.orderIndex,
            durationSec: item.durationSec,
          })),
        });
      }
      return nu;
    });

    const row = await this.prisma.playlist.findFirst({
      where: { id: created.id },
      include: { _count: { select: { items: true, screensInGroup: true } } },
    });
    if (!row) throw new NotFoundException('Playlist not found');
    return row;
  }

  /**
   * Copy playlist timeline into another workspace (duplicates media files and canvases).
   * Does not remove the source playlist.
   */
  async cloneToWorkspace(
    userId: string,
    sourceWorkspaceId: string,
    playlistId: string,
    targetWorkspaceId: string,
  ) {
    if (sourceWorkspaceId === targetWorkspaceId) {
      throw new BadRequestException(
        'Source and target workspace must be different.',
      );
    }
    await this.assertUserWorkspaceMember(userId, sourceWorkspaceId);
    await this.assertUserWorkspaceMember(userId, targetWorkspaceId);

    await this.ensurePlaylist(sourceWorkspaceId, playlistId);
    const pl = await this.prisma.playlist.findFirst({
      where: { id: playlistId, workspaceId: sourceWorkspaceId },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!pl) throw new NotFoundException('Playlist not found');

    const mediaIdMap = new Map<string, string>();
    const canvasIdMap = new Map<string, string>();

    for (const item of pl.items) {
      if (item.mediaId && !mediaIdMap.has(item.mediaId)) {
        const { id } = await this.mediaService.duplicateMediaToWorkspace({
          sourceWorkspaceId,
          mediaId: item.mediaId,
          targetWorkspaceId,
        });
        mediaIdMap.set(item.mediaId, id);
      }
      if (item.canvasId && !canvasIdMap.has(item.canvasId)) {
        const { id } = await this.canvasesService.duplicateCanvasToWorkspace({
          sourceWorkspaceId,
          canvasId: item.canvasId,
          targetWorkspaceId,
          createdById: userId,
        });
        canvasIdMap.set(item.canvasId, id);
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const nu = await tx.playlist.create({
        data: {
          workspaceId: targetWorkspaceId,
          name: this.makeClonedPlaylistName(pl.name),
          isPublished: false,
        },
      });
      for (const item of pl.items) {
        const mediaId = item.mediaId ? mediaIdMap.get(item.mediaId) : null;
        const canvasId = item.canvasId ? canvasIdMap.get(item.canvasId) : null;
        if (item.mediaId && !mediaId) {
          throw new BadRequestException('Failed to map media item for clone.');
        }
        if (item.canvasId && !canvasId) {
          throw new BadRequestException('Failed to map canvas item for clone.');
        }
        if (!item.mediaId && !item.canvasId) {
          continue;
        }
        await tx.playlistItem.create({
          data: {
            playlistId: nu.id,
            mediaId: mediaId ?? null,
            canvasId: canvasId ?? null,
            orderIndex: item.orderIndex,
            durationSec: item.durationSec,
          },
        });
      }
      return nu;
    });

    const row = await this.prisma.playlist.findFirst({
      where: { id: created.id },
      include: { _count: { select: { items: true, screensInGroup: true } } },
    });
    if (!row) throw new NotFoundException('Playlist not found');
    return row;
  }

  private makeDuplicatePlaylistName(name: string): string {
    const base = name.trim();
    if (base.toLowerCase().endsWith(' (copy)')) {
      return `${base} · ${Date.now().toString(36)}`;
    }
    return `${base} (copy)`;
  }

  private makeClonedPlaylistName(name: string): string {
    return `${name.trim()} (imported)`;
  }

  private async assertUserWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) {
      throw new ForbiddenException('No access to this workspace.');
    }
  }

  /**

   * Public playlist payload for player bootstrap and socket pushes.

   */

  async getPlaylistPayloadForScreen(
    screenId: string,
  ): Promise<Record<string, unknown> | null> {
    const screen = await this.prisma.screen.findUnique({
      where: { id: screenId },
    });

    if (!screen) return null;

    const resolved = await this.scheduling.resolveEffectivePlaylistId(
      screenId,

      new Date(),
    );

    if (!resolved.playlistId) {
      return {
        workspaceId: screen.workspaceId,

        screenId,

        playlistId: null,

        name: null,

        items: [],

        activeSource: resolved.source,
      };
    }

    const playlist = await this.prisma.playlist.findFirst({
      where: { id: resolved.playlistId, workspaceId: screen.workspaceId },

      include: {
        items: {
          orderBy: { orderIndex: 'asc' },

          include: { media: true, canvas: true },
        },
      },
    });

    if (!playlist) {
      return {
        workspaceId: screen.workspaceId,

        screenId,

        playlistId: null,

        name: null,

        items: [],

        activeSource: 'default',
      };
    }

    return this.buildPayload(
      screen.workspaceId,

      screen.id,

      playlist,

      resolved.source,
    );
  }

  /**
   * Pushes the resolved playlist to the player via Socket.IO.
   * When `alsoEmitScheduleSignal` is true (schedule CRUD), also emits `schedule:changed`
   * so clients listening on that channel stay in sync.
   */
  async emitPlaylistForScreen(
    screenId: string,
    options?: { alsoEmitScheduleSignal?: boolean },
  ): Promise<void> {
    const payload = await this.getPlaylistPayloadForScreen(screenId);

    if (payload) {
      this.heartbeat.emitContentSync(screenId, payload);
      if (options?.alsoEmitScheduleSignal) {
        this.heartbeat.emitScheduleChanged(screenId, payload);
      }
    }
  }

  async emitForPlaylist(playlistId: string): Promise<void> {
    const direct = await this.prisma.screen.findMany({
      where: {
        OR: [
          { activePlaylistId: playlistId },

          { overridePlaylistId: playlistId },
        ],
      },

      select: { id: true },
    });

    const scheduled = await this.prisma.schedule.findMany({
      where: { playlistId, enabled: true },

      select: { workspaceId: true, screenId: true },
    });

    const ids = new Set<string>(direct.map((d) => d.id));

    const workspaceWide = new Set<string>();

    for (const row of scheduled) {
      if (row.screenId) ids.add(row.screenId);
      else workspaceWide.add(row.workspaceId);
    }

    for (const workspaceId of workspaceWide) {
      const inWs = await this.prisma.screen.findMany({
        where: { workspaceId },

        select: { id: true },
      });

      for (const s of inWs) ids.add(s.id);
    }

    for (const id of ids) {
      await this.emitPlaylistForScreen(id);
    }
  }

  private async ensurePlaylist(
    workspaceId: string,

    id: string,
  ): Promise<Playlist> {
    const p = await this.prisma.playlist.findFirst({
      where: { id, workspaceId },
    });

    if (!p) throw new NotFoundException('Playlist not found');

    return p;
  }

  private serializePlaylist(
    playlist: Playlist & {
      items: (PlaylistItem & { media: Media | null; canvas: Canvas | null })[];
    },
  ) {
    return {
      id: playlist.id,

      workspaceId: playlist.workspaceId,

      name: playlist.name,

      isPublished: playlist.isPublished,

      createdAt: playlist.createdAt.toISOString(),

      updatedAt: playlist.updatedAt.toISOString(),

      items: playlist.items.map((item) => this.serializeItem(item)),
    };
  }

  private serializeItem(
    item: PlaylistItem & { media: Media | null; canvas: Canvas | null },
  ) {
    const base = {
      id: item.id,

      orderIndex: item.orderIndex,

      durationSec: item.durationSec,
    };

    if (item.mediaId && item.media) {
      return {
        ...base,

        kind: 'media' as const,

        media: this.mediaService.toResponse(item.media),
      };
    }

    if (item.canvasId && item.canvas) {
      return {
        ...base,

        kind: 'canvas' as const,

        canvas: this.canvasesService.toCompiledPayload(item.canvas),
      };
    }

    return {
      ...base,

      kind: 'unknown' as const,
    };
  }

  private buildPayload(
    workspaceId: string,

    screenId: string | null,

    playlist: Playlist & {
      items: (PlaylistItem & { media: Media | null; canvas: Canvas | null })[];
    },

    activeSource: 'override' | 'schedule' | 'default' = 'default',
  ) {
    return {
      workspaceId,

      screenId,

      playlistId: playlist.id,

      name: playlist.name,

      activeSource,

      items: playlist.items.map((item) => {
        if (item.mediaId && item.media) {
          return {
            kind: 'media' as const,

            orderIndex: item.orderIndex,

            durationSec: item.durationSec,

            media: this.mediaService.toResponse(item.media),
          };
        }

        if (item.canvasId && item.canvas) {
          return {
            kind: 'canvas' as const,

            orderIndex: item.orderIndex,

            durationSec: item.durationSec,

            canvas: this.canvasesService.toCompiledPayload(item.canvas),
          };
        }

        throw new Error('Invalid playlist item: missing media and canvas');
      }),
    };
  }
}
