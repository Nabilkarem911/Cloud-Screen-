import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get('current')
  current(@Query('workspaceId') workspaceId: string) {
    return this.subscriptions.getCurrent(workspaceId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch('mock-plan')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  setMockPlan(
    @Query('workspaceId') workspaceId: string,
    @Body() body: { plan?: 'FREE' | 'PRO' },
  ) {
    return this.subscriptions.setMockPlan(workspaceId, body.plan ?? 'FREE');
  }
}
