import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { AccountService } from './account.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.account.updateProfile(user.sub, dto);
  }

  @Post('email/request')
  requestEmailChange(
    @CurrentUser() user: JwtUser,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.account.requestEmailChange(user.sub, dto.newEmail);
  }

  @Post('email/verify')
  verifyEmailChange(
    @CurrentUser() user: JwtUser,
    @Body() dto: VerifyEmailChangeDto,
  ) {
    return this.account.verifyEmailChange(user.sub, dto.newEmail, dto.code);
  }

  @Get('billing')
  billing(@CurrentUser() user: JwtUser) {
    return this.account.getBilling(user.sub);
  }
}
