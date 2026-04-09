import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterStartDto } from './dto/register-start.dto';
import { RegisterVerifyDto } from './dto/register-verify.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { clearAuthCookies, setAuthCookies } from './auth-cookie.util';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(200)
  @Post('register/start')
  async registerStart(@Body() dto: RegisterStartDto) {
    return this.authService.registerStart(dto);
  }

  @HttpCode(200)
  @Post('register/verify')
  async registerVerify(
    @Body() dto: RegisterVerifyDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.registerVerify(dto);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      workspaces: result.workspaces,
      accessToken: result.accessToken,
    };
  }

  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      workspaces: result.workspaces,
      accessToken: result.accessToken,
    };
  }

  /** Development only: sign in as the first active user (no password). */
  @HttpCode(200)
  @Post('dev-login')
  async devLogin(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    user: { id: string; email: string; fullName: string; locale: string };
    workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
    accessToken: string;
  }> {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ENABLE_DEV_LOGIN !== 'true'
    ) {
      throw new NotFoundException();
    }
    const result = await this.authService.devLoginAsFirstUser();
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      workspaces: result.workspaces,
      accessToken: result.accessToken,
    };
  }

  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.cs_refresh_token as
      | string
      | undefined;
    const result = await this.authService.refreshTokens(refreshToken ?? '');
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return { success: true, accessToken: result.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub, user.impersonatedBy);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('exit-impersonation')
  async exitImpersonation(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.exitImpersonation(user);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
      workspaces: result.workspaces,
    };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @Post('logout')
  async logout(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.sub);
    clearAuthCookies(response);
  }
}
