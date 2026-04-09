import { randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { appendAuditLog } from '../admin/admin-runtime.store';
import { LoginDto } from './dto/login.dto';
import { RegisterStartDto } from './dto/register-start.dto';
import { RegisterVerifyDto } from './dto/register-verify.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcryptjs';

type TokenPayload = {
  sub: string;
  email: string;
  impersonatedBy?: string;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkspacesService))
    private readonly workspaces: WorkspacesService,
  ) {
    this.accessExpiresIn = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    );
    this.refreshExpiresIn = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
  }

  async registerStart(dto: RegisterStartDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const code = String(randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        businessName: dto.businessName.trim(),
        phone: dto.phone.trim(),
        country: dto.country.trim().toUpperCase().slice(0, 2),
        city: dto.city?.trim() || null,
        passwordHash,
        locale: dto.locale,
        emailVerified: false,
        verificationCode: otpHash,
        verificationCodeExpiresAt: expires,
      },
    });
    // Placeholder: real app sends email via SES/SendGrid
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[Register OTP] ${email} code=${code}`);
    } else {
      this.logger.log(`[Register OTP] verification code sent to ${email}`);
    }
    return { ok: true, message: 'Verification code sent.', email };
  }

  async registerVerify(dto: RegisterVerifyDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) throw new BadRequestException('Invalid code');
    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }
    if (
      !user.verificationCode ||
      !user.verificationCodeExpiresAt ||
      user.verificationCodeExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Code expired');
    }
    const ok = await bcrypt.compare(dto.code, user.verificationCode);
    if (!ok) throw new UnauthorizedException('Invalid code');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    const wsName = user.businessName || user.fullName;
    await this.workspaces.createForUser(user.id, `${wsName}'s Workspace`);

    const tokens = await this.issueTokenPair({
      sub: user.id,
      email: user.email,
    });
    await this.setRefreshTokenHash(user.id, tokens.refreshToken);

    const workspaceList = await this.buildWorkspaceListForUser(user.id, false);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: user.locale,
        isSuperAdmin: false,
        platformStaffRole: null,
        emailVerified: true,
      },
      workspaces: workspaceList,
      ...tokens,
    };
  }

  async forgotPassword(emailRaw: string) {
    const email = emailRaw.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = randomBytes(32).toString('hex');
      const hash = await bcrypt.hash(raw, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hash,
          passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `[Password reset] ${email} resetToken=${raw} (use with POST /auth/reset-password)`,
        );
      } else {
        this.logger.log(`[Password reset] flow initiated for ${email}`);
      }
    }
    return {
      ok: true,
      message: 'If an account exists, instructions were sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user?.passwordResetToken ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }
    const valid = await bcrypt.compare(dto.token, user.passwordResetToken);
    if (!valid) throw new BadRequestException('Invalid or expired token');
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
      },
    });
    return { ok: true };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        locale: true,
        isActive: true,
        isSuperAdmin: true,
        platformStaffRole: true,
        emailVerified: true,
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const isSuperAdmin = user.isSuperAdmin === true;
    const isStaff = user.platformStaffRole != null;
    if (!isSuperAdmin && !isStaff && user.emailVerified === false) {
      throw new UnauthorizedException(
        'Please verify your email before signing in.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair({
      sub: user.id,
      email: user.email,
    });
    await this.setRefreshTokenHash(user.id, tokens.refreshToken);

    if (isSuperAdmin) {
      try {
        await appendAuditLog({
          action: 'Super Admin Logged In',
          adminName: user.fullName,
          targetCustomer: '—',
          ipAddress: 'n/a',
        });
      } catch (err) {
        this.logger.error(
          '[auth] Super admin audit log failed',
          err instanceof Error ? err.stack : String(err),
        );
      }
      await this.workspaces.ensureAdminControlEntry(user.id);
    }

    const workspaceList = await this.buildWorkspaceListForUser(
      user.id,
      isSuperAdmin,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: user.locale,
        isSuperAdmin,
        platformStaffRole: user.platformStaffRole ?? null,
        emailVerified: user.emailVerified,
      },
      workspaces: workspaceList,
      ...tokens,
    };
  }

  /**
   * Dev helper: authenticate as the first active user (same response shape as login).
   */
  async devLoginAsFirstUser() {
    const user = await this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ emailVerified: true }, { isSuperAdmin: true }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        locale: true,
        isSuperAdmin: true,
        platformStaffRole: true,
      },
    });
    if (!user) {
      throw new BadRequestException(
        'No active users in the database. Register an account first.',
      );
    }

    const isSuperAdmin = user.isSuperAdmin === true;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair({
      sub: user.id,
      email: user.email,
    });
    await this.setRefreshTokenHash(user.id, tokens.refreshToken);

    if (isSuperAdmin) {
      await this.workspaces.ensureAdminControlEntry(user.id);
    }

    const workspaceList = await this.buildWorkspaceListForUser(
      user.id,
      isSuperAdmin,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: user.locale,
        isSuperAdmin,
        platformStaffRole: user.platformStaffRole ?? null,
      },
      workspaces: workspaceList,
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret',
    );
    let userId: string;
    let impersonatedByFromRefresh: string | undefined;
    try {
      const decoded = await this.jwtService.verifyAsync<TokenPayload>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );
      userId = decoded.sub;
      impersonatedByFromRefresh = decoded.impersonatedBy;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true, refreshTokenHash: true },
    });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueTokenPair(
      { sub: user.id, email: user.email },
      impersonatedByFromRefresh
        ? { impersonatedBy: impersonatedByFromRefresh }
        : undefined,
    );
    await this.setRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  /**
   * Super-admin only: mint tokens for another user (session becomes that user).
   */
  async issueImpersonation(actorUserId: string, targetUserId: string) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { isSuperAdmin: true },
    });
    if (!actor?.isSuperAdmin) throw new ForbiddenException();

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        locale: true,
        isActive: true,
        isSuperAdmin: true,
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!target.isActive) throw new BadRequestException('User is suspended');

    const tokens = await this.issueTokenPair(
      {
        sub: target.id,
        email: target.email,
      },
      { impersonatedBy: actorUserId },
    );
    await this.setRefreshTokenHash(target.id, tokens.refreshToken);

    return {
      user: {
        id: target.id,
        email: target.email,
        fullName: target.fullName,
        locale: target.locale,
        isSuperAdmin: target.isSuperAdmin,
      },
      ...tokens,
    };
  }

  async exitImpersonation(jwtUser: { sub: string; impersonatedBy?: string }) {
    const superAdminId = jwtUser.impersonatedBy;
    if (!superAdminId) throw new ForbiddenException('Not impersonating');

    const superAdmin = await this.prisma.user.findUnique({
      where: { id: superAdminId },
      select: {
        id: true,
        email: true,
        fullName: true,
        locale: true,
        isSuperAdmin: true,
        isActive: true,
      },
    });
    if (!superAdmin?.isSuperAdmin || !superAdmin.isActive) {
      throw new ForbiddenException();
    }

    const tokens = await this.issueTokenPair({
      sub: superAdmin.id,
      email: superAdmin.email,
    });
    await this.setRefreshTokenHash(superAdmin.id, tokens.refreshToken);

    const workspaceList = await this.buildWorkspaceListForUser(
      superAdmin.id,
      true,
    );

    await appendAuditLog({
      action: 'IMPERSONATION_END',
      adminName: superAdmin.fullName,
      targetCustomer: jwtUser.sub,
      ipAddress: 'n/a',
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        locale: superAdmin.locale,
        isSuperAdmin: true,
      },
      workspaces: workspaceList,
    };
  }

  async me(userId: string, impersonatedBy?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        locale: true,
        isActive: true,
        isSuperAdmin: true,
        platformStaffRole: true,
        businessName: true,
        phone: true,
        country: true,
        city: true,
        emailVerified: true,
        memberships: {
          select: {
            role: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) return null;
    const isSuperAdmin = user.isSuperAdmin === true;
    const profile = {
      businessName: user.businessName ?? null,
      phone: user.phone ?? null,
      country: user.country ?? null,
      city: user.city ?? null,
      emailVerified: user.emailVerified,
    };
    if (isSuperAdmin) {
      const all = await this.prisma.workspace.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, slug: true },
      });
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: user.locale,
        isActive: user.isActive,
        isSuperAdmin: true,
        platformStaffRole: user.platformStaffRole ?? null,
        impersonatedBy: impersonatedBy ?? null,
        ...profile,
        memberships: all.map((w) => ({
          role: 'OWNER',
          workspace: w,
        })),
      };
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      locale: user.locale,
      isActive: user.isActive,
      isSuperAdmin: false,
      platformStaffRole: user.platformStaffRole ?? null,
      impersonatedBy: impersonatedBy ?? null,
      ...profile,
      memberships: user.memberships,
    };
  }

  private async buildWorkspaceListForUser(
    userId: string,
    isSuperAdmin: boolean,
  ): Promise<
    Array<{ id: string; name: string; slug: string; role: string }>
  > {
    if (isSuperAdmin) {
      const all = await this.prisma.workspace.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, slug: true },
      });
      return all.map((w) => ({ ...w, role: 'OWNER' }));
    }
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: {
        role: true,
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));
  }

  private async issueTokenPair(
    payload: TokenPayload,
    options?: { impersonatedBy?: string },
  ): Promise<TokenPair> {
    const accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'dev-access-secret',
    );
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev-refresh-secret',
    );

    const tokenPayload = {
      ...payload,
      ...(options?.impersonatedBy
        ? { impersonatedBy: options.impersonatedBy }
        : {}),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: accessSecret,
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret: refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async setRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  private parseDurationToSeconds(value: string): number {
    const trimmed = value.trim().toLowerCase();
    const match = /^(\d+)([smhd])$/.exec(trimmed);
    if (!match) return Number(trimmed) || 900;

    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 's') return amount;
    if (unit === 'm') return amount * 60;
    if (unit === 'h') return amount * 3600;
    return amount * 86400;
  }
}
