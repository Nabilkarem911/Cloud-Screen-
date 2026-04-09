import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';
import { JwtUser } from './current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      query: Record<string, string | undefined>;
      body: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
      headers: Record<string, string | undefined>;
    }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Unauthorized');

    if (user.isSuperAdmin) {
      return true;
    }

    const workspaceId =
      request.params.workspaceId ??
      request.query.workspaceId ??
      request.body.workspaceId ??
      request.headers['x-workspace-id'];

    if (!workspaceId) {
      throw new BadRequestException(
        'workspaceId is required for role-protected workspace routes.',
      );
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.sub,
        },
      },
      select: { role: true },
    });

    if (!membership)
      throw new ForbiddenException('No workspace membership found');
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient workspace role');
    }

    return true;
  }
}
