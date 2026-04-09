import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  PrismaClient,
  PlatformStaffRole,
  ScreenStatus,
  UserRole,
  UserSubscriptionStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const CLIENT_WORKSPACE_NAME = 'My First Client Branch';
const SCREEN_A = 'CS-CLIENT-LOBBY-001';
const SCREEN_B = 'CS-CLIENT-CONF-002';
const PLAYLIST_NAME = 'Demo Loop';

/** Fallback 2×2 PNG if network fetch fails (still valid image bytes). */
const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const DEMO_MEDIA: Array<{ originalName: string; mimeType: string }> = [
  { originalName: 'demo-01-landscape.jpg', mimeType: 'image/jpeg' },
  { originalName: 'demo-02-city.jpg', mimeType: 'image/jpeg' },
  { originalName: 'demo-03-nature.jpg', mimeType: 'image/jpeg' },
  { originalName: 'demo-04-abstract.jpg', mimeType: 'image/jpeg' },
  { originalName: 'demo-05-waves.jpg', mimeType: 'image/jpeg' },
];

/** Stable Picsum IDs — distinct photos, 1200×800. */
const PICSUM_IDS = [1011, 1012, 1013, 1014, 1015];

async function fetchImageBytes(index: number): Promise<Buffer> {
  const id = PICSUM_IDS[index] ?? 1015;
  const url = `https://picsum.photos/id/${id}/1200/800`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(String(res.status));
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return FALLBACK_PNG;
  }
}

function wipeUploadsDir(): void {
  const uploadRoot = join(process.cwd(), 'uploads');
  try {
    rmSync(uploadRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const SEED_ADMIN_EMAIL = 'admin@cloudsignage.local';
const SEED_CLIENT_EMAIL = 'admin2@client.local';
const SEED_WORKSPACE_NAMES = [CLIENT_WORKSPACE_NAME, 'Admin Control'];

/**
 * Idempotent: removes prior seed users/workspaces so `db seed` can be re-run after schema changes.
 */
async function wipeSeedAccounts(): Promise<void> {
  /** Invalidate all refresh sessions so logins succeed after schema drift. */
  await prisma.user.updateMany({ data: { refreshTokenHash: null } });

  const existing = await prisma.user.findMany({
    where: { email: { in: [SEED_ADMIN_EMAIL, SEED_CLIENT_EMAIL] } },
    select: { id: true },
  });
  const seedUserIds = existing.map((u) => u.id);
  if (seedUserIds.length > 0) {
    await prisma.canvas.deleteMany({
      where: { createdById: { in: seedUserIds } },
    });
  }

  await prisma.workspace.deleteMany({
    where: { name: { in: SEED_WORKSPACE_NAMES } },
  });

  await prisma.user.deleteMany({
    where: { email: { in: [SEED_ADMIN_EMAIL, SEED_CLIENT_EMAIL] } },
  });
}

async function main() {
  wipeUploadsDir();
  await wipeSeedAccounts();

  const passwordSuper = await bcrypt.hash('admin', 12);
  const passwordClient = await bcrypt.hash('123', 12);

  const admin2SubEnd = new Date();
  admin2SubEnd.setDate(admin2SubEnd.getDate() + 30);

  const admin = await prisma.user.create({
    data: {
      email: SEED_ADMIN_EMAIL,
      fullName: 'Super Admin',
      businessName: 'Cloud Signage Platform',
      phone: '+1-555-0100',
      country: 'US',
      city: 'San Francisco',
      emailVerified: true,
      passwordHash: passwordSuper,
      isSuperAdmin: true,
      platformStaffRole: PlatformStaffRole.SUPER_ADMIN,
      locale: 'en',
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      email: SEED_CLIENT_EMAIL,
      fullName: 'Client Admin',
      businessName: 'Demo Client Business',
      phone: '+971501234567',
      country: 'AE',
      city: 'Dubai',
      emailVerified: true,
      passwordHash: passwordClient,
      isSuperAdmin: false,
      platformStaffRole: null,
      subscriptionStatus: UserSubscriptionStatus.ACTIVE,
      subscriptionEndDate: admin2SubEnd,
      locale: 'en',
    },
  });

  await prisma.paymentRecord.createMany({
    data: [
      {
        userId: admin2.id,
        amountCents: 49900,
        currency: 'USD',
        status: 'PAID',
        description: 'Pro plan — monthly',
        invoiceRef: 'INV-DEMO-001',
        paidAt: new Date(Date.now() - 86400000 * 35),
      },
      {
        userId: admin2.id,
        amountCents: 49900,
        currency: 'USD',
        status: 'PAID',
        description: 'Pro plan — monthly',
        invoiceRef: 'INV-DEMO-002',
        paidAt: new Date(Date.now() - 86400000 * 5),
      },
    ],
  });

  const slug = `branch-${randomUUID().slice(0, 8)}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: CLIENT_WORKSPACE_NAME,
      slug,
      defaultLocale: 'en',
      members: {
        create: {
          userId: admin2.id,
          role: UserRole.ADMIN,
        },
      },
      subscription: {
        create: {
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.TRIALING,
          seats: 25,
          screenLimit: 100,
        },
      },
    },
  });

  const wsId = workspace.id;
  const uploadRoot = join(process.cwd(), 'uploads', 'media');
  const dir = join(uploadRoot, wsId);
  mkdirSync(dir, { recursive: true });

  const mediaIds: string[] = [];
  for (let i = 0; i < DEMO_MEDIA.length; i++) {
    const meta = DEMO_MEDIA[i];
    const bytes = await fetchImageBytes(i);
    const isPng = bytes.equals(FALLBACK_PNG);
    const ext = isPng ? 'png' : 'jpg';
    const fileName = `${randomUUID()}.${ext}`;
    writeFileSync(join(dir, fileName), bytes);
    const relativePath = join(wsId, fileName).replace(/\\/g, '/');
    const row = await prisma.media.create({
      data: {
        workspaceId: wsId,
        fileName,
        originalName: isPng
          ? meta.originalName.replace(/\.jpg$/i, '.png')
          : meta.originalName,
        mimeType: isPng ? 'image/png' : meta.mimeType,
        sizeBytes: bytes.length,
        relativePath,
      },
    });
    mediaIds.push(row.id);
  }

  const screenA = await prisma.screen.create({
    data: {
      workspaceId: wsId,
      name: 'Lobby Display',
      serialNumber: SCREEN_A,
      status: ScreenStatus.ONLINE,
      location: 'Main lobby',
    },
  });

  const screenB = await prisma.screen.create({
    data: {
      workspaceId: wsId,
      name: 'Conference Room',
      serialNumber: SCREEN_B,
      status: ScreenStatus.ONLINE,
      location: 'Floor 2',
    },
  });

  const playlist = await prisma.playlist.create({
    data: {
      workspaceId: wsId,
      name: PLAYLIST_NAME,
      isPublished: true,
    },
  });

  for (let i = 0; i < mediaIds.length; i++) {
    await prisma.playlistItem.create({
      data: {
        playlistId: playlist.id,
        mediaId: mediaIds[i],
        orderIndex: i,
        durationSec: 8,
      },
    });
  }

  await prisma.screen.update({
    where: { id: screenA.id },
    data: { activePlaylistId: playlist.id },
  });
  await prisma.screen.update({
    where: { id: screenB.id },
    data: { activePlaylistId: playlist.id },
  });

  console.log(
    `Atomic seed OK — Super Admin: ${SEED_ADMIN_EMAIL} / admin (id ${admin.id}) · platformStaffRole=SUPER_ADMIN`,
  );
  console.log(
    `Client Admin: ${SEED_CLIENT_EMAIL} / 123 (id ${admin2.id}) · platformStaffRole=null · workspace "${CLIENT_WORKSPACE_NAME}" (${wsId})`,
  );
  console.log(
    `Demo content: ${DEMO_MEDIA.length} media · 2 screens (${SCREEN_A}, ${SCREEN_B}) · playlist "${PLAYLIST_NAME}".`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
