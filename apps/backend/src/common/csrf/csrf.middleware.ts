import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      next();
      return;
    }

    const path = req.originalUrl ?? req.url ?? '';
    const exemptPrefixes = [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/refresh',
      '/api/v1/auth/dev-login',
      '/api/v1/webhooks/stripe',
      '/api/v1/player/pairing/sessions',
    ];
    if (exemptPrefixes.some((prefix) => path.startsWith(prefix))) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ')
    ) {
      next();
      return;
    }

    const cookieToken = req.cookies?.csrf_token as string | undefined;
    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      res.status(403).json({ message: 'Invalid CSRF token' });
      return;
    }

    next();
  }
}
