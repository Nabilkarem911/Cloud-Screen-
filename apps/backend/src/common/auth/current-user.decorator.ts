import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  sub: string;
  email: string;
  isSuperAdmin?: boolean;
  /** Present when a super admin is viewing as another user. */
  impersonatedBy?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
