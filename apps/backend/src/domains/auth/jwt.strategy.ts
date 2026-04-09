import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Request } from 'express';

type JwtPayload = {
  sub: string;
  email: string;
  isSuperAdmin?: boolean;
  impersonatedBy?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          request?.cookies?.cs_access_token as string | null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev-access-secret',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isActive: true, isSuperAdmin: true },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('User is not active');

    return {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin === true,
      impersonatedBy: payload.impersonatedBy,
    };
  }
}
