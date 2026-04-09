import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtUser } from './current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Super admin only');
    }
    return true;
  }
}
