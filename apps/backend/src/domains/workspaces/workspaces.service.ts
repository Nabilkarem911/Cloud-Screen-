import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
  ScreenStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';

/** Minimal valid 1×1 PNG (transparent). */
const DEMO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
  'base64',
);

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly heartbeat: ScreenHeartbeatService,
  ) {}

  /**
   * When the database has zero workspaces, create an empty Admin Control workspace (super-admin).
   * No sample playlists, screens, or media — tenants add content manually.
   */
  async ensureAdminControlEntry(userId: string): Promise<void> {
    const total = await this.prisma.workspace.count();
    if (total > 0) return;
    await this.createForUser(userId, 'Admin Control');
  }

  async createForUser(userId: string, name: string) {
    const slug = this.makeSlug(name);
    const workspace = await this.prisma.$transaction(async (tx) => {
      const w = await tx.workspace.create({
        data: {
          name: name.trim(),
          slug,
          defaultLocale: 'en',
          members: {
            create: { userId, role: 'OWNER' },
          },
          subscription: {
            create: {
              plan: SubscriptionPlan.FREE,
              status: SubscriptionStatus.TRIALING,
              seats: 5,
              screenLimit: 25,
              storageLimitBytes: 5 * 1024 * 1024 * 1024,
            },
          },
        },
        select: { id: true, name: true, slug: true },
      });
      return w;
    });
    return workspace;
  }

  /**
   * One-shot demo: only when the user has zero workspace memberships.
   * Creates workspace + 2 screens + 3 sample images.
   */
  async bootstrapDemo(userId: string) {
    const membershipCount = await this.prisma.workspaceMember.count({
      where: { userId },
    });
    if (membershipCount > 0) {
      throw new BadRequestException(
        'You already belong to a workspace. Use “Seed demo content” on an existing workspace instead.',
      );
    }

    const ws = await this.createForUser(userId, 'Demo Workspace');
    await this.seedDemoContent(ws.id);
    return {
      workspace: ws,
      message: 'Demo workspace created with sample screens and media.',
    };
  }

  async seedDemoContent(workspaceId: string) {
    const screenCount = await this.prisma.screen.count({
      where: { workspaceId },
    });
    if (screenCount < 2) {
      const base = Date.now();
      const templates = [
        {
          name: 'Lobby Display',
          serialNumber: `CS-DEMO-${base}-A`,
          location: 'Main lobby',
        },
        {
          name: 'Conference Room',
          serialNumber: `CS-DEMO-${base}-B`,
          location: 'Floor 2',
        },
      ];
      for (let i = screenCount; i < 2; i++) {
        const t = templates[i];
        await this.prisma.screen.create({
          data: {
            workspaceId,
            name: t.name,
            serialNumber: t.serialNumber,
            status: ScreenStatus.ONLINE,
            location: t.location,
          },
        });
      }
    }

    const mediaCount = await this.prisma.media.count({
      where: { workspaceId },
    });
    const samples = [
      { originalName: 'sample-hero.png', mimeType: 'image/png' },
      { originalName: 'sample-promo.png', mimeType: 'image/png' },
      { originalName: 'sample-brand.png', mimeType: 'image/png' },
      { originalName: 'sample-banner.png', mimeType: 'image/png' },
      { originalName: 'sample-thumb.png', mimeType: 'image/png' },
    ];
    const targetMedia = 5;
    let mediaAdded = 0;
    for (let i = mediaCount; i < targetMedia; i++) {
      const meta = samples[i % samples.length];
      await this.media.saveUploadedFile({
        workspaceId,
        buffer: DEMO_PNG,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        size: DEMO_PNG.length,
      });
      mediaAdded += 1;
    }

    const demoPlaylist = await this.prisma.playlist.findFirst({
      where: { workspaceId, name: 'Demo Loop' },
    });
    if (!demoPlaylist) {
      const mediaRows = await this.prisma.media.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });
      if (mediaRows.length > 0) {
        const playlist = await this.prisma.playlist.create({
          data: {
            workspaceId,
            name: 'Demo Loop',
            isPublished: true,
          },
        });
        await this.prisma.$transaction(async (tx) => {
          for (let i = 0; i < mediaRows.length; i++) {
            await tx.playlistItem.create({
              data: {
                playlistId: playlist.id,
                mediaId: mediaRows[i].id,
                orderIndex: i,
                durationSec: 10,
              },
            });
          }
        });
        const screens = await this.prisma.screen.findMany({
          where: { workspaceId },
          take: 2,
        });
        for (const s of screens) {
          await this.prisma.screen.update({
            where: { id: s.id },
            data: { activePlaylistId: playlist.id },
          });
        }
      }
    }

    return {
      ok: true,
      screensAdded: Math.max(0, 2 - screenCount),
      mediaAdded,
    };
  }

  async seedDemoForMember(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (user?.isSuperAdmin) {
      return this.seedDemoContent(workspaceId);
    }
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!m) throw new NotFoundException('Workspace not found');
    if (m.role !== 'OWNER' && m.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only owners and admins can seed demo content.',
      );
    }
    return this.seedDemoContent(workspaceId);
  }

  async listMembers(workspaceId: string) {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            locale: true,
            isActive: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      membershipId: r.id,
      role: r.role,
      joinedAt: r.createdAt.toISOString(),
      user: r.user,
    }));
  }

  /** Placeholder until email + invite tokens are wired (Stripe / Resend). */
  inviteDemo(
    workspaceId: string,
    email: string,
    role: string,
  ): {
    ok: true;
    demo: true;
    message: string;
    workspaceId: string;
    email: string;
    role: string;
  } {
    return {
      ok: true,
      demo: true,
      message:
        'Invite pipeline is not connected yet. This demo records your intent only.',
      workspaceId,
      email: email.trim().toLowerCase(),
      role,
    };
  }

  async updateWorkspace(
    userId: string,
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ) {
    await this.assertWorkspaceAccess(workspaceId, userId, true);
    if (dto.name === undefined && dto.isPaused === undefined) {
      throw new BadRequestException('No fields to update.');
    }
    const data: { name?: string; slug?: string; isPaused?: boolean } = {};
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (trimmed.length < 2) {
        throw new BadRequestException('Workspace name is too short.');
      }
      data.name = trimmed;
      data.slug = this.makeSlug(trimmed);
    }
    if (dto.isPaused !== undefined) {
      data.isPaused = dto.isPaused;
    }
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
      select: { id: true, name: true, slug: true, isPaused: true },
    });
  }

  async deleteWorkspace(userId: string, workspaceId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      const membership = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      });
      if (!membership) throw new NotFoundException('Workspace not found');
      if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new ForbiddenException(
          'Only workspace owners and admins can delete this branch.',
        );
      }
    }
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  private async assertWorkspaceAccess(
    workspaceId: string,
    userId: string,
    requireAdmin: boolean,
  ) {
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
    if (
      requireAdmin &&
      membership.role !== 'OWNER' &&
      membership.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Only owners and admins can update this workspace.',
      );
    }
  }

  private makeSlug(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = Date.now().toString(36);
    return `${base || 'workspace'}-${suffix}`;
  }

  /**
   * Emits `pairing:started` on `workspace:{id}` so dashboards in the Add Screen flow
   * can show live feedback (also call when the pairing modal opens).
   */
  async notifyPairingStarted(
    userId: string,
    workspaceId: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      const m = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      });
      if (!m) throw new NotFoundException('Workspace not found');
      if (m.role !== UserRole.OWNER && m.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only owners and admins can signal pairing activity.',
        );
      }
    }
    this.heartbeat.emitPairingStarted(workspaceId, {
      source: 'dashboard',
      at: new Date().toISOString(),
    });
    return { ok: true as const };
  }
}
