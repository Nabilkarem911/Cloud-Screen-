import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as os from 'os';
import {
  PlatformStaffRole,
  UserRole,
  UserSubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';
import { SubscriptionEmailService } from '../email/subscription-email.service';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import {
  appendAuditLog,
  getAdminSettings,
  listAuditLogs,
  updateAdminSettings,
} from './admin-runtime.store';
import * as bcrypt from 'bcryptjs';

const IDLE_LOGIN_DAYS = 90;

export type CustomerLifecycleStatus =
  | 'active'
  | 'expired'
  | 'suspended'
  | 'trial';

function computeCustomerLifecycle(
  u: {
    isActive: boolean;
    subscriptionStatus: UserSubscriptionStatus;
    subscriptionEndDate: Date | null;
  },
  now = new Date(),
): CustomerLifecycleStatus {
  if (!u.isActive) return 'suspended';
  if (u.subscriptionEndDate && u.subscriptionEndDate < now) return 'expired';
  if (u.subscriptionStatus === UserSubscriptionStatus.EXPIRED) return 'expired';
  if (u.subscriptionStatus === UserSubscriptionStatus.TRIAL) return 'trial';
  return 'active';
}

function isIdleAccount(lastLoginAt: Date | null, now = new Date()): boolean {
  if (!lastLoginAt) return true;
  const ms = IDLE_LOGIN_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - lastLoginAt.getTime() > ms;
}

function isExpiredOrIdleTab(
  lifecycle: CustomerLifecycleStatus,
  idle: boolean,
): boolean {
  return lifecycle === 'expired' || idle;
}

function platformRoleLabel(
  isSuperAdmin: boolean,
  platformStaffRole: PlatformStaffRole | null,
  memberships: { role: UserRole }[],
): 'SUPER_ADMIN' | 'SUPPORT_SPECIALIST' | 'BILLING_MANAGER' | 'ADMIN' | 'USER' {
  if (isSuperAdmin) return 'SUPER_ADMIN';
  if (platformStaffRole === PlatformStaffRole.SUPPORT_SPECIALIST)
    return 'SUPPORT_SPECIALIST';
  if (platformStaffRole === PlatformStaffRole.BILLING_MANAGER)
    return 'BILLING_MANAGER';
  const elevated = memberships.some(
    (m) => m.role === UserRole.ADMIN || m.role === UserRole.OWNER,
  );
  if (elevated) return 'ADMIN';
  return 'USER';
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly workspaces: WorkspacesService,
    private readonly heartbeat: ScreenHeartbeatService,
    private readonly subscriptionEmail: SubscriptionEmailService,
  ) {}

  async listUsers() {
    const [users, membersRows, mediaAgg] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          businessName: true,
          locale: true,
          isActive: true,
          isSuperAdmin: true,
          platformStaffRole: true,
          createdAt: true,
          lastLoginAt: true,
          subscriptionStatus: true,
          subscriptionEndDate: true,
          memberships: { select: { role: true } },
          _count: { select: { memberships: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workspaceMember.findMany({
        select: { userId: true, workspaceId: true },
      }),
      this.prisma.media.groupBy({
        by: ['workspaceId'],
        _sum: { sizeBytes: true },
      }),
    ]);
    const wsSize = new Map(
      mediaAgg.map((m) => [m.workspaceId, m._sum.sizeBytes ?? 0]),
    );
    const storageByUser = new Map<string, number>();
    for (const row of membersRows) {
      const add = wsSize.get(row.workspaceId) ?? 0;
      storageByUser.set(
        row.userId,
        (storageByUser.get(row.userId) ?? 0) + add,
      );
    }
    const now = new Date();
    return users.map((u) => {
      const lifecycle = computeCustomerLifecycle(u, now);
      const idle = isIdleAccount(u.lastLoginAt, now);
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        businessName: u.businessName,
        locale: u.locale,
        isActive: u.isActive,
        isSuperAdmin: u.isSuperAdmin,
        platformStaffRole: u.platformStaffRole,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionEndDate: u.subscriptionEndDate,
        customerLifecycle: lifecycle,
        isIdle: idle,
        expiredOrIdle: isExpiredOrIdleTab(lifecycle, idle),
        storageBytes: storageByUser.get(u.id) ?? 0,
        totalWorkspaces: u._count.memberships,
        platformRole: platformRoleLabel(
          u.isSuperAdmin,
          u.platformStaffRole,
          u.memberships,
        ),
      };
    });
  }

  async listStaff() {
    const adminControl = await this.prisma.workspace.findFirst({
      where: { name: 'Admin Control' },
      select: { id: true },
    });
    if (!adminControl) return [];
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: adminControl.id },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            isSuperAdmin: true,
            lastLoginAt: true,
          },
        },
      },
    });
    return members.map((m) => ({
      ...m.user,
      adminRole: m.user.isSuperAdmin ? 'SUPER_ADMIN' : m.role,
    }));
  }

  async createStaff(input: {
    fullName: string;
    email: string;
    password: string;
    adminRole: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'SUPER_ADMIN';
  }) {
    const email = input.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email already registered');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: input.fullName.trim(),
        passwordHash,
        emailVerified: true,
        isSuperAdmin: input.adminRole === 'SUPER_ADMIN',
        platformStaffRole:
          input.adminRole === 'SUPER_ADMIN'
            ? PlatformStaffRole.SUPER_ADMIN
            : PlatformStaffRole.SUPPORT_SPECIALIST,
      },
      select: { id: true, email: true, fullName: true },
    });
    let adminControl = await this.prisma.workspace.findFirst({
      where: { name: 'Admin Control' },
      select: { id: true },
    });
    if (!adminControl) {
      const ws = await this.workspaces.createForUser(user.id, 'Admin Control');
      adminControl = { id: ws.id };
    }
    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: adminControl.id, userId: user.id } },
      create: {
        workspaceId: adminControl.id,
        userId: user.id,
        role: input.adminRole === 'SUPER_ADMIN' ? UserRole.OWNER : (input.adminRole as UserRole),
      },
      update: {
        role: input.adminRole === 'SUPER_ADMIN' ? UserRole.OWNER : (input.adminRole as UserRole),
      },
    });
    return user;
  }

  async updateStaffRole(userId: string, role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Staff user not found');
    let adminControl = await this.prisma.workspace.findFirst({
      where: { name: 'Admin Control' },
      select: { id: true },
    });
    if (!adminControl) {
      const ws = await this.workspaces.createForUser(userId, 'Admin Control');
      adminControl = { id: ws.id };
    }
    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: adminControl.id, userId } },
      create: {
        workspaceId: adminControl.id,
        userId,
        role: role === 'SUPER_ADMIN' ? UserRole.OWNER : (role as UserRole),
      },
      update: {
        role: role === 'SUPER_ADMIN' ? UserRole.OWNER : (role as UserRole),
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isSuperAdmin: role === 'SUPER_ADMIN',
        platformStaffRole:
          role === 'SUPER_ADMIN'
            ? PlatformStaffRole.SUPER_ADMIN
            : PlatformStaffRole.SUPPORT_SPECIALIST,
      },
    });
    return { ok: true };
  }

  async listCustomers(
    q?: string,
    filter: 'all' | 'active' | 'expired' | 'trial' = 'all',
  ) {
    let rows = await this.listUsers();
    rows = rows.filter((u) => !u.isSuperAdmin && u.platformStaffRole == null);
    if (filter !== 'all') {
      rows = rows.filter((u) => {
        if (filter === 'active') return u.customerLifecycle === 'active';
        if (filter === 'expired') return u.customerLifecycle === 'expired';
        if (filter === 'trial') return u.customerLifecycle === 'trial';
        return true;
      });
    }
    const term = q?.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (u) =>
          u.email.toLowerCase().includes(term) ||
          u.fullName.toLowerCase().includes(term) ||
          (u.businessName &&
            u.businessName.toLowerCase().includes(term)),
      );
    }
    return rows;
  }

  async getCustomerProfile(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        fullName: true,
        businessName: true,
        phone: true,
        country: true,
        city: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        isSuperAdmin: true,
        platformStaffRole: true,
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    if (user.isSuperAdmin || user.platformStaffRole != null) {
      throw new NotFoundException('Customer not found');
    }

    const now = new Date();
    const lifecycle = computeCustomerLifecycle(user, now);

    const ownerMemberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId: customerId,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      select: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: { select: { screens: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workspaceIds = ownerMemberships.map((m) => m.workspace.id);
    const storageRows =
      workspaceIds.length === 0
        ? []
        : await this.prisma.media.groupBy({
            by: ['workspaceId'],
            where: { workspaceId: { in: workspaceIds } },
            _sum: { sizeBytes: true },
          });
    const storageByWs = new Map(
      storageRows.map((r) => [r.workspaceId, r._sum.sizeBytes ?? 0]),
    );

    let totalScreens = 0;
    let totalStorageBytes = 0;
    const branches = ownerMemberships.map((m) => {
      const w = m.workspace;
      const screens = w._count.screens;
      const storage = storageByWs.get(w.id) ?? 0;
      totalScreens += screens;
      totalStorageBytes += storage;
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        createdAt: w.createdAt,
        screenCount: screens,
        storageBytes: storage,
      };
    });

    let analytics: {
      screensByStatus: Record<string, number>;
      totalPlaylists: number;
      totalMedia: number;
      totalMediaBytes: number;
    } = {
      screensByStatus: {},
      totalPlaylists: 0,
      totalMedia: 0,
      totalMediaBytes: 0,
    };
    if (workspaceIds.length > 0) {
      const [screenGroups, playlistCount, mediaAgg] = await Promise.all([
        this.prisma.screen.groupBy({
          by: ['status'],
          where: { workspaceId: { in: workspaceIds } },
          _count: { _all: true },
        }),
        this.prisma.playlist.count({
          where: { workspaceId: { in: workspaceIds } },
        }),
        this.prisma.media.aggregate({
          where: { workspaceId: { in: workspaceIds } },
          _count: { _all: true },
          _sum: { sizeBytes: true },
        }),
      ]);
      const screensByStatus: Record<string, number> = {};
      for (const row of screenGroups) {
        screensByStatus[row.status] = row._count._all;
      }
      analytics = {
        screensByStatus,
        totalPlaylists: playlistCount,
        totalMedia: mediaAgg._count._all,
        totalMediaBytes: mediaAgg._sum.sizeBytes ?? 0,
      };
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      businessName: user.businessName,
      phone: user.phone,
      country: user.country,
      city: user.city,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndDate: user.subscriptionEndDate,
      customerLifecycle: lifecycle,
      branches,
      usage: {
        totalScreens,
        totalStorageBytes,
      },
      analytics,
    };
  }

  /**
   * Super-admin view: one workspace (branch) for a billable customer, with screens list.
   * Ensures the workspace is owned/managed by the customer (OWNER or ADMIN membership).
   */
  async getCustomerWorkspaceDetail(customerId: string, workspaceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        isSuperAdmin: true,
        platformStaffRole: true,
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    if (user.isSuperAdmin || user.platformStaffRole != null) {
      throw new NotFoundException('Customer not found');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: customerId,
        workspaceId,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      select: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found for this customer');
    }

    const screens = await this.prisma.screen.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        serialNumber: true,
        status: true,
        location: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      customerId,
      workspace: membership.workspace,
      screens,
    };
  }

  async sendSubscriptionReminder(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        fullName: true,
        isSuperAdmin: true,
        platformStaffRole: true,
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    if (user.isSuperAdmin || user.platformStaffRole != null) {
      throw new NotFoundException('Customer not found');
    }
    await this.subscriptionEmail.sendRenewalReminder(user.email, user.fullName);
    return { ok: true, message: 'Reminder queued (placeholder email service).' };
  }

  async listWorkspaces() {
    const [workspaces, storageRows] = await Promise.all([
      this.prisma.workspace.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          members: {
            where: { role: { in: [UserRole.OWNER, UserRole.ADMIN] } },
            select: {
              role: true,
              userId: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                  isSuperAdmin: true,
                  platformStaffRole: true,
                },
              },
            },
          },
          _count: {
            select: { screens: true, medias: true },
          },
        },
      }),
      this.prisma.media.groupBy({
        by: ['workspaceId'],
        _sum: { sizeBytes: true },
      }),
    ]);
    const storageByWs = new Map(
      storageRows.map((r) => [r.workspaceId, r._sum.sizeBytes ?? 0]),
    );
    return workspaces.map((w) => {
      const primary =
        w.members.find((m) => m.role === UserRole.OWNER) ?? w.members[0];
      const owner = primary?.user;
      const ownerId = primary?.userId ?? null;
      const isBillableCustomer =
        owner &&
        !owner.isSuperAdmin &&
        owner.platformStaffRole == null;
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        createdAt: w.createdAt,
        ownerId,
        ownerCustomerProfileId: isBillableCustomer ? ownerId : null,
        ownerEmail: owner?.email ?? null,
        ownerName: owner?.fullName ?? null,
        screenCount: w._count.screens,
        mediaCount: w._count.medias,
        storageBytes: storageByWs.get(w.id) ?? 0,
      };
    });
  }

  async getGlobalStats() {
    const [onlineScreens, totalActiveUsers, totalWorkspaces, totalActiveCustomers, paymentAgg] = await Promise.all([
      this.prisma.screen.count({ where: { status: 'ONLINE' } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.workspace.count(),
      this.prisma.user.count({
        where: {
          isActive: true,
          isSuperAdmin: false,
          platformStaffRole: null,
        },
      }),
      this.prisma.paymentRecord.aggregate({
        where: {
          OR: [{ paidAt: { not: null } }, { status: { in: ['PAID', 'SUCCEEDED', 'SUCCESS'] } }],
        },
        _sum: { amountCents: true },
      }),
    ]);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg();
    return {
      revenueUsdPlaceholder: Math.round((paymentAgg._sum.amountCents ?? 0) / 100),
      totalConnectedScreens: onlineScreens,
      totalActiveUsers,
      totalActiveCustomers,
      totalWorkspaces,
      realtimeSocketConnections: this.heartbeat.getConnectedSocketCount(),
      server: {
        loadAvg1m: load[0] ?? 0,
        memoryUsedBytes: totalMem - freeMem,
        memoryTotalBytes: totalMem,
        hostname: os.hostname(),
        platform: os.platform(),
      },
    };
  }

  async updateUser(actorId: string, userId: string, dto: UpdateAdminUserDto) {
    if (userId === actorId && dto.isActive === false) {
      throw new BadRequestException('You cannot suspend your own account.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('User not found');

    const data: {
      fullName?: string;
      isActive?: boolean;
      isSuperAdmin?: boolean;
      platformStaffRole?: PlatformStaffRole | null;
      subscriptionStatus?: UserSubscriptionStatus;
      subscriptionEndDate?: Date | null;
    } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isSuperAdmin !== undefined) {
      if (userId === actorId && dto.isSuperAdmin === false) {
        throw new ForbiddenException('You cannot remove your own super admin flag.');
      }
      data.isSuperAdmin = dto.isSuperAdmin;
    }
    if (dto.platformStaffRole !== undefined) {
      if (dto.platformStaffRole === PlatformStaffRole.SUPER_ADMIN) {
        data.isSuperAdmin = true;
        data.platformStaffRole = PlatformStaffRole.SUPER_ADMIN;
      } else if (dto.platformStaffRole === null) {
        data.platformStaffRole = null;
      } else {
        data.platformStaffRole = dto.platformStaffRole;
        data.isSuperAdmin = false;
      }
    }
    if (dto.subscriptionStatus !== undefined) {
      data.subscriptionStatus = dto.subscriptionStatus;
    }
    if (dto.subscriptionEndDate !== undefined) {
      data.subscriptionEndDate =
        dto.subscriptionEndDate === null
          ? null
          : new Date(dto.subscriptionEndDate);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No changes');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        isSuperAdmin: true,
        platformStaffRole: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
      },
    });
  }

  async createCustomerWorkspace(customerId: string, name: string) {
    const u = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!u || u.isSuperAdmin || u.platformStaffRole != null) {
      throw new NotFoundException('Customer not found');
    }
    return this.workspaces.createForUser(customerId, name.trim());
  }

  async updateCustomerWorkspace(
    customerId: string,
    workspaceId: string,
    name: string,
  ) {
    const m = await this.prisma.workspaceMember.findFirst({
      where: { userId: customerId, workspaceId },
    });
    if (!m) throw new NotFoundException('Workspace not found');
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: name.trim() },
      select: { id: true, name: true, slug: true },
    });
  }

  async deleteCustomerWorkspace(customerId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findFirst({
      where: { userId: customerId, workspaceId },
    });
    if (!m) throw new NotFoundException('Workspace not found');
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { ok: true };
  }

  async patchCustomerSubscription(
    customerId: string,
    dto: {
      subscriptionStatus?: UserSubscriptionStatus;
      subscriptionEndDate?: string | null;
      isActive?: boolean;
    },
  ) {
    const u = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!u || u.isSuperAdmin || u.platformStaffRole != null) {
      throw new NotFoundException('Customer not found');
    }
    const data: {
      subscriptionStatus?: UserSubscriptionStatus;
      subscriptionEndDate?: Date | null;
      isActive?: boolean;
    } = {};
    if (dto.subscriptionStatus !== undefined) {
      data.subscriptionStatus = dto.subscriptionStatus;
    }
    if (dto.subscriptionEndDate !== undefined) {
      data.subscriptionEndDate =
        dto.subscriptionEndDate === null
          ? null
          : new Date(dto.subscriptionEndDate);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No changes');
    }
    return this.prisma.user.update({
      where: { id: customerId },
      data,
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        isActive: true,
      },
    });
  }

  async impersonateUser(
    actorId: string,
    targetUserId: string,
    workspaceId?: string,
  ) {
    const tokens = await this.auth.issueImpersonation(actorId, targetUserId);
    const me = await this.auth.me(targetUserId);
    if (!me) throw new NotFoundException();

    if (workspaceId) {
      const member = await this.prisma.workspaceMember.findFirst({
        where: { userId: targetUserId, workspaceId },
      });
      if (!member) {
        throw new BadRequestException(
          'User is not a member of this workspace.',
        );
      }
    }

    let workspaces = me.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    }));

    if (workspaceId) {
      const pick = workspaces.find((w) => w.id === workspaceId);
      if (!pick) {
        throw new BadRequestException('Workspace not available for this user.');
      }
      workspaces = [
        pick,
        ...workspaces.filter((w) => w.id !== workspaceId),
      ];
    }

    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: actorId },
        select: { fullName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { businessName: true, fullName: true },
      }),
    ]);
    await appendAuditLog({
      action: 'IMPERSONATION_START',
      adminName: actor?.fullName ?? actorId,
      targetCustomer: target?.businessName || target?.fullName || targetUserId,
      ipAddress: 'n/a',
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        locale: me.locale,
        isSuperAdmin: me.isSuperAdmin,
      },
      workspaces,
    };
  }

  async listLogs() {
    return listAuditLogs();
  }

  async getSettings() {
    return getAdminSettings();
  }

  async patchSettings(
    dto: Partial<{
      platformName: string;
      supportEmail: string;
      maintenanceMode: boolean;
      defaultLanguage: string;
      logoUrlEn: string;
      logoUrlAr: string;
      logoAssetEnLight: string;
      logoAssetEnDark: string;
      logoAssetArLight: string;
      logoAssetArDark: string;
      brandingEpoch: number;
    }>,
  ) {
    return updateAdminSettings(dto);
  }
}
