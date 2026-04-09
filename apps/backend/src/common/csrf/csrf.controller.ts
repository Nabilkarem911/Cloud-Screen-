import { Controller, Get, Res } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Response } from 'express';

@Controller('csrf')
export class CsrfController {
  @Get()
  issue(@Res({ passthrough: true }) res: Response): { csrfToken: string } {
    const token = randomBytes(32).toString('hex');
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('csrf_token', token, {
      httpOnly: false,
      sameSite: 'lax',
      secure,
      path: '/',
    });
    return { csrfToken: token };
  }
}
