import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, RolesGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
