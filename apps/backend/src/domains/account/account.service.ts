import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { emailChangeOtpEmail } from '../email/email-templates';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async updateProfile(
    userId: string,
    dto: { fullName?: string; businessName?: string; phone?: string },
  ) {
    const data: Record<string, string> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.businessName !== undefined)
      data.businessName = dto.businessName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
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
        businessName: true,
        phone: true,
        country: true,
        city: true,
      },
    });
  }

  async requestEmailChange(userId: string, newEmailRaw: string) {
    const newEmail = newEmailRaw.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (existing) throw new ConflictException('Email already registered');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException();
    if (user.email === newEmail) throw new BadRequestException('Same email');
    const code = String(randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: newEmail,
        pendingEmailOtp: otpHash,
        pendingEmailOtpExpiresAt: expires,
      },
    });
    const prod = process.env.NODE_ENV === 'production';
    if (prod && !this.email.isConfigured()) {
      throw new ServiceUnavailableException('Email is not configured');
    }
    if (this.email.isConfigured()) {
      const tpl = emailChangeOtpEmail({ code });
      await this.email.sendMail({
        to: newEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      if (!prod) {
        this.logger.log(`[Email change OTP] also emailed ${newEmail}`);
      }
    } else if (!prod) {
      this.logger.log(`[Email change OTP] ${newEmail} code=${code}`);
    }
    return { ok: true, message: 'Verification code sent to new email.' };
  }

  async verifyEmailChange(userId: string, newEmailRaw: string, code: string) {
    const newEmail = newEmailRaw.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pendingEmail || user.pendingEmail !== newEmail) {
      throw new BadRequestException('No pending change');
    }
    if (
      !user.pendingEmailOtp ||
      !user.pendingEmailOtpExpiresAt ||
      user.pendingEmailOtpExpiresAt < new Date()
    ) {
      throw new BadRequestException('Code expired');
    }
    const ok = await bcrypt.compare(code, user.pendingEmailOtp);
    if (!ok) throw new BadRequestException('Invalid code');
    if (
      await this.prisma.user.findFirst({
        where: { email: newEmail, id: { not: userId } },
      })
    ) {
      throw new ConflictException('Email already registered');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        pendingEmail: null,
        pendingEmailOtp: null,
        pendingEmailOtpExpiresAt: null,
      },
      select: { id: true, email: true, fullName: true },
    });
  }

  async getBilling(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionEndDate: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        memberships: {
          take: 1,
          select: {
            workspace: {
              select: {
                subscription: {
                  select: {
                    plan: true,
                    status: true,
                    seats: true,
                    screenLimit: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user) throw new ForbiddenException();
    const wsSub = user.memberships[0]?.workspace.subscription;
    return {
      currentPlan: {
        userSubscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
        workspacePlan: wsSub?.plan ?? null,
        workspaceStatus: wsSub?.status ?? null,
        seats: wsSub?.seats ?? null,
        screenLimit: wsSub?.screenLimit ?? null,
      },
      payments: user.payments,
    };
  }

  async getInsights(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        memberships: {
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                isPaused: true,
                createdAt: true,
                subscription: {
                  select: {
                    plan: true,
                    status: true,
                    seats: true,
                    screenLimit: true,
                    storageLimitBytes: true,
                    currentPeriodEnd: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user) throw new ForbiddenException();

    const branches = await Promise.all(
      user.memberships.map(async (m) => {
        const workspaceId = m.workspace.id;
        const [screens, playlists, media] = await Promise.all([
          this.prisma.screen.findMany({
            where: { workspaceId },
            select: { id: true, status: true },
          }),
          this.prisma.playlist.count({ where: { workspaceId } }),
          this.prisma.media.findMany({
            where: { workspaceId },
            select: { sizeBytes: true },
          }),
        ]);

        const screenStatus = screens.reduce(
          (acc, s) => {
            if (s.status === 'ONLINE') acc.online += 1;
            else if (s.status === 'MAINTENANCE') acc.maintenance += 1;
            else acc.offline += 1;
            return acc;
          },
          { online: 0, offline: 0, maintenance: 0 },
        );

        const storageBytes = media.reduce((sum, x) => sum + x.sizeBytes, 0);
        return {
          workspaceId,
          name: m.workspace.name,
          slug: m.workspace.slug,
          isPaused: m.workspace.isPaused,
          role: m.role,
          createdAt: m.workspace.createdAt.toISOString(),
          screens: screens.length,
          playlists,
          mediaCount: media.length,
          storageBytes,
          screenStatus,
          subscription: m.workspace.subscription
            ? {
                plan: m.workspace.subscription.plan,
                status: m.workspace.subscription.status,
                seats: m.workspace.subscription.seats,
                screenLimit: m.workspace.subscription.screenLimit,
                storageLimitBytes: m.workspace.subscription.storageLimitBytes,
                currentPeriodEnd:
                  m.workspace.subscription.currentPeriodEnd?.toISOString() ??
                  null,
              }
            : null,
        };
      }),
    );

    const totals = branches.reduce(
      (acc, b) => {
        acc.branches += 1;
        acc.screens += b.screens;
        acc.playlists += b.playlists;
        acc.mediaCount += b.mediaCount;
        acc.storageBytes += b.storageBytes;
        acc.screenStatus.online += b.screenStatus.online;
        acc.screenStatus.offline += b.screenStatus.offline;
        acc.screenStatus.maintenance += b.screenStatus.maintenance;
        return acc;
      },
      {
        branches: 0,
        screens: 0,
        playlists: 0,
        mediaCount: 0,
        storageBytes: 0,
        screenStatus: { online: 0, offline: 0, maintenance: 0 },
      },
    );

    const firstSub = branches.find((b) => b.subscription)?.subscription ?? null;
    return {
      account: {
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate?.toISOString() ?? null,
      },
      plan: firstSub,
      totals,
      branches,
    };
  }
}
