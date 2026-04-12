import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StripeController } from './stripe.controller';

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [StripeController],
  providers: [RolesGuard],
})
export class StripeModule {}
