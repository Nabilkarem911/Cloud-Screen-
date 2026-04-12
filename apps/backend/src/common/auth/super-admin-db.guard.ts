import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from './current-user.decorator';

/**
 * Confirms the authenticated user is still an active super-admin in the database
 * (JWT claims alone are not sufficient for highly sensitive admin routes).
 */
@Injectable()
export class SuperAdminDbGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const sub = request.user?.sub;
    if (!sub) {
      throw new ForbiddenException('Super admin only');
    }
    const row = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { isActive: true, isSuperAdmin: true },
    });
    if (!row?.isActive || !row.isSuperAdmin) {
      throw new ForbiddenException('Super admin only');
    }
    return true;
  }
}
