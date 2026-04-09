import type { Response } from 'express';

type CookieConfig = {
  secure: boolean;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
};

function parseDurationToMs(value: string): number {
  const trimmed = value.trim().toLowerCase();
  const match = /^(\d+)([smhd])$/.exec(trimmed);
  if (!match) return Number(trimmed) * 1000 || 900000;

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60000;
  if (unit === 'h') return amount * 3600000;
  return amount * 86400000;
}

export function getCookieConfig(): CookieConfig {
  const secure = process.env.NODE_ENV === 'production';
  return {
    secure,
    accessMaxAgeMs: parseDurationToMs(
      process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    ),
    refreshMaxAgeMs: parseDurationToMs(
      process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    ),
  };
}

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
): void {
  const config = getCookieConfig();
  const common = {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax' as const,
    path: '/',
  };

  response.cookie('cs_access_token', accessToken, {
    ...common,
    maxAge: config.accessMaxAgeMs,
  });
  response.cookie('cs_refresh_token', refreshToken, {
    ...common,
    maxAge: config.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(response: Response): void {
  const config = getCookieConfig();
  const common = {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax' as const,
    path: '/',
  };
  response.clearCookie('cs_access_token', common);
  response.clearCookie('cs_refresh_token', common);
}
