import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';

@Injectable()
export class CanvasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heartbeat: ScreenHeartbeatService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateCanvasDto) {
    return this.prisma.canvas.create({
      data: {
        workspaceId,
        createdById: userId,
        name: dto.name.trim(),
        width: dto.width ?? 1920,
        height: dto.height ?? 1080,
        layoutData: (dto.layoutData ?? {}) as object,
        durationSec: dto.durationSec ?? 15,
      },
      select: this.canvasSelect,
    });
  }

  async list(workspaceId: string) {
    return this.prisma.canvas.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: this.canvasSelect,
    });
  }

  async getById(workspaceId: string, id: string) {
    const canvas = await this.prisma.canvas.findFirst({
      where: { id, workspaceId },
      select: this.canvasSelect,
    });
    if (!canvas) throw new NotFoundException('Canvas not found');
    return canvas;
  }

  async update(workspaceId: string, id: string, dto: UpdateCanvasDto) {
    await this.getById(workspaceId, id);
    const updated = await this.prisma.canvas.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
        ...(dto.height !== undefined ? { height: dto.height } : {}),
        ...(dto.durationSec !== undefined ? { durationSec: dto.durationSec } : {}),
        ...(dto.layoutData !== undefined
          ? { layoutData: dto.layoutData as object }
          : {}),
      },
      select: this.canvasSelect,
    });
    await this.broadcastCanvasLive(id);
    return updated;
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    await this.getById(workspaceId, id);
    const used = await this.prisma.playlistItem.count({
      where: { canvasId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'Canvas is used in one or more playlists. Remove it from playlists first.',
      );
    }
    await this.prisma.canvas.delete({ where: { id } });
  }

  /**
   * Public compiled shape for the player / playlist payloads.
   */
  toCompiledPayload(canvas: {
    id: string;
    name: string;
    width: number;
    height: number;
    layoutData: unknown;
    durationSec: number;
  }) {
    return {
      id: canvas.id,
      name: canvas.name,
      width: canvas.width,
      height: canvas.height,
      durationSec: canvas.durationSec,
      layoutData: canvas.layoutData ?? {},
    };
  }

  async getCompiledForPlayer(workspaceId: string, canvasId: string) {
    const canvas = await this.prisma.canvas.findFirst({
      where: { id: canvasId, workspaceId },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        layoutData: true,
        durationSec: true,
      },
    });
    if (!canvas) throw new NotFoundException('Canvas not found');
    return this.toCompiledPayload(canvas);
  }

  private async broadcastCanvasLive(canvasId: string): Promise<void> {
    const canvas = await this.prisma.canvas.findUnique({
      where: { id: canvasId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        width: true,
        height: true,
        layoutData: true,
        durationSec: true,
      },
    });
    if (!canvas) return;
    const screenIds = await this.findScreenIdsForCanvas(canvasId);
    const payload = {
      canvasId: canvas.id,
      workspaceId: canvas.workspaceId,
      name: canvas.name,
      width: canvas.width,
      height: canvas.height,
      durationSec: canvas.durationSec,
      layoutData: canvas.layoutData ?? {},
      at: new Date().toISOString(),
    };
    for (const screenId of screenIds) {
      this.heartbeat.emitCanvasLive(screenId, payload);
    }
  }

  private async findScreenIdsForCanvas(canvasId: string): Promise<string[]> {
    const items = await this.prisma.playlistItem.findMany({
      where: { canvasId },
      select: { playlistId: true },
    });
    const playlistIds = [...new Set(items.map((i) => i.playlistId))];
    if (playlistIds.length === 0) return [];
    const screens = await this.prisma.screen.findMany({
      where: { activePlaylistId: { in: playlistIds } },
      select: { id: true },
    });
    return screens.map((s) => s.id);
  }

  private readonly canvasSelect = {
    id: true,
    workspaceId: true,
    name: true,
    width: true,
    height: true,
    durationSec: true,
    layoutData: true,
    type: true,
    contentUrl: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}
