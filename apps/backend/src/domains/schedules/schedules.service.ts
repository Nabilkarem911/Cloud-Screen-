import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulingService } from './scheduling.service';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly heartbeat: ScreenHeartbeatService,
    @Inject(forwardRef(() => PlaylistsService))
    private readonly playlists: PlaylistsService,
  ) {}

  async list(workspaceId: string) {
    return this.prisma.schedule.findMany({
      where: { workspaceId },
      orderBy: [{ priority: 'desc' }, { startTime: 'asc' }],
      include: {
        playlist: { select: { id: true, name: true } },
        screen: { select: { id: true, name: true } },
      },
    });
  }

  async listOverlaps(workspaceId: string) {
    const rows = await this.prisma.schedule.findMany({
      where: { workspaceId, enabled: true },
      select: {
        id: true,
        screenId: true,
        daysOfWeek: true,
        startTime: true,
        endTime: true,
        priority: true,
      },
    });
    const pairs = this.scheduling.findOverlappingPairs(rows);
    return { pairs };
  }

  async getOne(workspaceId: string, id: string) {
    const s = await this.prisma.schedule.findFirst({
      where: { id, workspaceId },
      include: {
        playlist: { select: { id: true, name: true } },
        screen: { select: { id: true, name: true } },
      },
    });
    if (!s) throw new NotFoundException('Schedule not found');
    return s;
  }

  async create(dto: CreateScheduleDto) {
    await this.ensureRefs(
      dto.workspaceId,
      dto.playlistId,
      dto.screenId ?? null,
    );

    const created = await this.prisma.schedule.create({
      data: {
        workspaceId: dto.workspaceId,
        playlistId: dto.playlistId,
        screenId: dto.screenId?.trim() ? dto.screenId.trim() : null,
        daysOfWeek: dto.daysOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        priority: dto.priority ?? 0,
        enabled: dto.enabled ?? true,
      },
      include: {
        playlist: { select: { id: true, name: true } },
        screen: { select: { id: true, name: true } },
      },
    });

    await this.broadcastAffected(dto.workspaceId, dto.screenId ?? null);
    return created;
  }

  async update(workspaceId: string, id: string, dto: UpdateScheduleDto) {
    const existing = await this.getOne(workspaceId, id);
    const nextPlaylistId = dto.playlistId ?? existing.playlistId;
    const nextScreenId =
      dto.screenId === undefined
        ? existing.screenId
        : dto.screenId?.trim()
          ? dto.screenId.trim()
          : null;

    await this.ensureRefs(workspaceId, nextPlaylistId, nextScreenId);

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        ...(dto.playlistId !== undefined ? { playlistId: dto.playlistId } : {}),
        ...(dto.screenId !== undefined
          ? { screenId: dto.screenId?.trim() ? dto.screenId.trim() : null }
          : {}),
        ...(dto.daysOfWeek !== undefined ? { daysOfWeek: dto.daysOfWeek } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      include: {
        playlist: { select: { id: true, name: true } },
        screen: { select: { id: true, name: true } },
      },
    });

    await this.broadcastAffected(workspaceId, existing.screenId);
    await this.broadcastAffected(workspaceId, updated.screenId);
    return updated;
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const existing = await this.getOne(workspaceId, id);
    await this.prisma.schedule.delete({ where: { id } });
    await this.broadcastAffected(workspaceId, existing.screenId);
  }

  private async ensureRefs(
    workspaceId: string,
    playlistId: string,
    screenId: string | null,
  ) {
    const pl = await this.prisma.playlist.findFirst({
      where: { id: playlistId, workspaceId },
    });
    if (!pl) throw new BadRequestException('Playlist not found in workspace');

    if (screenId) {
      const sc = await this.prisma.screen.findFirst({
        where: { id: screenId, workspaceId },
      });
      if (!sc) throw new BadRequestException('Screen not found in workspace');
    }
  }

  /**
   * After any schedule create/update/delete, push the recomputed playlist to every
   * affected screen (workspace-wide schedules fan out to all screens).
   * Uses `content:sync` plus `schedule:changed` so all player listeners receive the update.
   */
  private async broadcastAffected(
    workspaceId: string,
    screenId: string | null,
  ): Promise<void> {
    const ids = await this.affectedScreenIds(workspaceId, screenId);
    for (const sid of ids) {
      await this.playlists.emitPlaylistForScreen(sid, {
        alsoEmitScheduleSignal: true,
      });
    }
  }

  private async affectedScreenIds(
    workspaceId: string,
    screenId: string | null,
  ): Promise<string[]> {
    if (screenId) return [screenId];
    const screens = await this.prisma.screen.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    return screens.map((s) => s.id);
  }
}
