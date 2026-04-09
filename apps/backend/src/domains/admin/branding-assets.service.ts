import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import type { Express } from 'express';
import { getAdminSettings, updateAdminSettings } from './admin-runtime.store';

export const BRANDING_VARIANTS = [
  'en-light',
  'en-dark',
  'ar-light',
  'ar-dark',
] as const;

export type BrandingVariant = (typeof BRANDING_VARIANTS)[number];

const BRANDING_DIR = join(process.cwd(), '.data', 'branding');
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/svg+xml') return 'svg';
  return 'bin';
}

function variantToSettingsKey(
  v: BrandingVariant,
):
  | 'logoAssetEnLight'
  | 'logoAssetEnDark'
  | 'logoAssetArLight'
  | 'logoAssetArDark' {
  switch (v) {
    case 'en-light':
      return 'logoAssetEnLight';
    case 'en-dark':
      return 'logoAssetEnDark';
    case 'ar-light':
      return 'logoAssetArLight';
    case 'ar-dark':
      return 'logoAssetArDark';
    default:
      throw new BadRequestException('Invalid variant');
  }
}

@Injectable()
export class BrandingAssetsService {
  async ensureDir(): Promise<void> {
    await mkdir(BRANDING_DIR, { recursive: true });
  }

  async uploadVariant(
    variant: string,
    file: Express.Multer.File,
  ): Promise<{ variant: BrandingVariant; filename: string }> {
    if (!BRANDING_VARIANTS.includes(variant as BrandingVariant)) {
      throw new BadRequestException('Invalid variant');
    }
    const v = variant as BrandingVariant;
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File too large (max 2MB)');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type');
    }
    await this.ensureDir();

    const settings = await getAdminSettings();
    const key = variantToSettingsKey(v);
    const prev = settings[key]?.trim();
    const ext = extFromMime(file.mimetype);
    const filename = `${v}.${ext}`;
    const dest = join(BRANDING_DIR, filename);
    if (prev && prev !== filename) {
      try {
        await unlink(join(BRANDING_DIR, prev));
      } catch {
        /* ignore */
      }
    }

    await writeFile(dest, file.buffer);

    const nextEpoch = (settings.brandingEpoch ?? 0) + 1;
    await updateAdminSettings({
      [key]: filename,
      brandingEpoch: nextEpoch,
    });
    return { variant: v, filename };
  }

  async resolveAbsolutePath(
    variant: string,
  ): Promise<{ absPath: string; mime: string }> {
    if (!BRANDING_VARIANTS.includes(variant as BrandingVariant)) {
      throw new NotFoundException();
    }
    const v = variant as BrandingVariant;
    const settings = await getAdminSettings();
    const key = variantToSettingsKey(v);
    const name = settings[key]?.trim();
    if (!name) throw new NotFoundException();
    const absPath = join(BRANDING_DIR, name);
    const mime = name.endsWith('.svg')
      ? 'image/svg+xml'
      : name.endsWith('.webp')
        ? 'image/webp'
        : name.endsWith('.jpg') || name.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'image/png';
    return { absPath, mime };
  }
}
