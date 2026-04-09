import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { AdminController } from './admin.controller';
import { BrandingController } from './branding.controller';
import { BrandingAssetsService } from './branding-assets.service';
import { AdminService } from './admin.service';
import { SubscriptionEmailService } from '../email/subscription-email.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => WorkspacesModule),
    RealtimeModule,
  ],
  controllers: [AdminController, BrandingController],
  providers: [
    SuperAdminGuard,
    AdminService,
    SubscriptionEmailService,
    BrandingAssetsService,
  ],
})
export class AdminModule {}
