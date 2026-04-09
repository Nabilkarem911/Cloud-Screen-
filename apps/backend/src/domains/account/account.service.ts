import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    userId: string,
    dto: { fullName?: string; businessName?: string; phone?: string },
  ) {
    const data: Record<string, string> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.businessName !== undefined) data.businessName = dto.businessName.trim();
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
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[Email change OTP] ${newEmail} code=${code}`);
    } else {
      this.logger.log(`[Email change OTP] verification sent for ${newEmail}`);
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
}
