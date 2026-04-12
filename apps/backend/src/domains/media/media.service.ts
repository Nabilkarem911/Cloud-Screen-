import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { copyFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const MAX_BYTES = 150 * 1024 * 1024;

@Injectable()
export class MediaService {
  private readonly uploadRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadRoot = this.config.get<string>(
      'MEDIA_UPLOAD_DIR',
      join(process.cwd(), 'uploads', 'media'),
    );
  }

  getPublicBaseUrl(): string {
    return (
      this.config.get<string>('MEDIA_PUBLIC_BASE_URL') ??
      `http://localhost:${this.config.get<string>('PORT', '3000')}`
    );
  }

  buildPublicUrl(relativePath: string): string {
    const base = this.getPublicBaseUrl().replace(/\/$/, '');
    const segments = relativePath.split('/').map(encodeURIComponent).join('/');
    return `${base}/media-files/${segments}`;
  }

  ensureUploadDir(workspaceId: string): string {
    const dir = join(this.uploadRoot, workspaceId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  async saveUploadedFile(params: {
    workspaceId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
    folderId?: string | null;
  }) {
    if (!ALLOWED_MIME.has(params.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${params.mimeType}`,
      );
    }
    if (params.size > MAX_BYTES) {
      throw new BadRequestException('File exceeds maximum allowed size.');
    }

    if (params.folderId) {
      const folder = await this.prisma.mediaFolder.findFirst({
        where: { id: params.folderId, workspaceId: params.workspaceId },
        select: { id: true },
      });
      if (!folder) {
        throw new BadRequestException('Folder not found');
      }
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { workspaceId: params.workspaceId },
      select: { storageLimitBytes: true },
    });
    if (sub?.storageLimitBytes != null) {
      const agg = await this.prisma.media.aggregate({
        where: { workspaceId: params.workspaceId },
        _sum: { sizeBytes: true },
      });
      const used = agg._sum.sizeBytes ?? 0;
      if (used + params.size > sub.storageLimitBytes) {
        throw new ForbiddenException('STORAGE_LIMIT_REACHED');
      }
    }

    const dir = this.ensureUploadDir(params.workspaceId);
    const ext = this.safeExt(params.originalName, params.mimeType);
    const fileName = `${randomUUID()}${ext}`;
    const relativePath = join(params.workspaceId, fileName).replace(/\\/g, '/');
    const absolutePath = join(dir, fileName);

    await import('fs/promises').then((fs) =>
      fs.writeFile(absolutePath, params.buffer),
    );

    return this.prisma.media.create({
      data: {
        workspaceId: params.workspaceId,
        fileName,
        originalName: params.originalName,
        mimeType: params.mimeType,
        sizeBytes: params.size,
        relativePath,
        folderId: params.folderId ?? null,
      },
    });
  }

  async list(workspaceId: string) {
    const items = await this.prisma.media.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { folder: true },
    });
    return items.map((m) => this.toResponse(m));
  }

  async getById(workspaceId: string, id: string) {
    const media = await this.prisma.media.findFirst({
      where: { id, workspaceId },
      include: { folder: true },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.toResponse(media);
  }

  /**
   * Copy a media file into another workspace (new DB row + file on disk).
   * Used when cloning playlists across branches.
   */
  async duplicateMediaToWorkspace(params: {
    sourceWorkspaceId: string;
    mediaId: string;
    targetWorkspaceId: string;
  }): Promise<{ id: string }> {
    const media = await this.prisma.media.findFirst({
      where: {
        id: params.mediaId,
        workspaceId: params.sourceWorkspaceId,
      },
    });
    if (!media) throw new NotFoundException('Media not found');

    const srcAbs = join(this.uploadRoot, ...media.relativePath.split('/'));
    if (!existsSync(srcAbs)) {
      throw new BadRequestException('Media file is missing on disk.');
    }

    const dir = this.ensureUploadDir(params.targetWorkspaceId);
    const ext = this.safeExt(media.originalName, media.mimeType);
    const fileName = `${randomUUID()}${ext}`;
    const relativePath = join(params.targetWorkspaceId, fileName).replace(
      /\\/g,
      '/',
    );
    const destAbs = join(dir, fileName);

    await copyFile(srcAbs, destAbs);

    const created = await this.prisma.media.create({
      data: {
        workspaceId: params.targetWorkspaceId,
        fileName,
        originalName: media.originalName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        relativePath,
        folderId: null,
      },
      select: { id: true },
    });
    return created;
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: { id, workspaceId },
    });
    if (!media) throw new NotFoundException('Media not found');

    const used = await this.prisma.playlistItem.count({
      where: { mediaId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'Media is referenced by playlists. Remove it from playlists first.',
      );
    }

    const abs = join(this.uploadRoot, ...media.relativePath.split('/'));
    await this.prisma.media.delete({ where: { id } });
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        // ignore
      }
    }
  }

  async listFolders(workspaceId: string) {
    return this.prisma.mediaFolder.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { medias: true } },
      },
    });
  }

  async createFolder(workspaceId: string, name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('Folder name is too short');
    }
    return this.prisma.mediaFolder.create({
      data: { workspaceId, name: trimmed },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { medias: true } },
      },
    });
  }

  async renameFolder(workspaceId: string, folderId: string, name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('Folder name is too short');
    }
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, workspaceId },
      select: { id: true },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    return this.prisma.mediaFolder.update({
      where: { id: folderId },
      data: { name: trimmed },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { medias: true } },
      },
    });
  }

  async deleteFolder(workspaceId: string, folderId: string) {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, workspaceId },
      select: { id: true },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    await this.prisma.media.updateMany({
      where: { workspaceId, folderId },
      data: { folderId: null },
    });
    await this.prisma.mediaFolder.delete({ where: { id: folderId } });
  }

  async moveMediaToFolder(
    workspaceId: string,
    mediaId: string,
    folderId: string | null,
  ) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, workspaceId },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (folderId) {
      const folder = await this.prisma.mediaFolder.findFirst({
        where: { id: folderId, workspaceId },
        select: { id: true },
      });
      if (!folder) throw new NotFoundException('Folder not found');
    }
    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: { folderId },
      include: { folder: true },
    });
    return this.toResponse(updated);
  }

  toResponse(media: {
    id: string;
    workspaceId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    relativePath: string;
    folderId?: string | null;
    folder?: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: media.id,
      workspaceId: media.workspaceId,
      fileName: media.fileName,
      originalName: media.originalName,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      relativePath: media.relativePath,
      folderId: media.folderId ?? null,
      folderName: media.folder?.name ?? null,
      publicUrl: this.buildPublicUrl(media.relativePath),
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    };
  }

  private safeExt(originalName: string, mime: string): string {
    const lower = originalName.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return '.jpg';
    if (lower.endsWith('.png')) return '.png';
    if (lower.endsWith('.gif')) return '.gif';
    if (lower.endsWith('.webp')) return '.webp';
    if (lower.endsWith('.mp4')) return '.mp4';
    if (lower.endsWith('.webm')) return '.webm';
    if (lower.endsWith('.mov')) return '.mov';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'video/mp4') return '.mp4';
    return '';
  }
}
