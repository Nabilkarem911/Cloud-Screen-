import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
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
      `http://localhost:${this.config.get<string>('PORT', '4000')}`
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
  }) {
    if (!ALLOWED_MIME.has(params.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${params.mimeType}`,
      );
    }
    if (params.size > MAX_BYTES) {
      throw new BadRequestException('File exceeds maximum allowed size.');
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
      },
    });
  }

  async list(workspaceId: string) {
    const items = await this.prisma.media.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((m) => this.toResponse(m));
  }

  async getById(workspaceId: string, id: string) {
    const media = await this.prisma.media.findFirst({
      where: { id, workspaceId },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.toResponse(media);
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

  toResponse(media: {
    id: string;
    workspaceId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    relativePath: string;
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
