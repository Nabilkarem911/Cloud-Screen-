import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
}
