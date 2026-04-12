import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { CsrfModule } from './common/csrf/csrf.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './domains/auth/auth.module';
import { WorkspacesModule } from './domains/workspaces/workspaces.module';
import { ScreensModule } from './domains/screens/screens.module';
import { CanvasesModule } from './domains/canvases/canvases.module';
import { PlaylistsModule } from './domains/playlists/playlists.module';
import { SubscriptionsModule } from './domains/subscriptions/subscriptions.module';
import { StripeModule } from './domains/stripe/stripe.module';
import { RealtimeModule } from './domains/realtime/realtime.module';
import { MediaModule } from './domains/media/media.module';
import { PlayerModule } from './domains/player/player.module';
import { SchedulesModule } from './domains/schedules/schedules.module';
import { AdminModule } from './domains/admin/admin.module';
import { AccountModule } from './domains/account/account.module';
import { WebhooksModule } from './domains/webhooks/webhooks.module';
import { MaintenanceModule } from './domains/maintenance/maintenance.module';
import { EmailModule } from './domains/email/email.module';

@Module({
  imports: [
    ...(process.env.SENTRY_DSN?.trim() ? [SentryModule.forRoot()] : []),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    EmailModule,
    CsrfModule,
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    ScreensModule,
    CanvasesModule,
    MediaModule,
    PlaylistsModule,
    SchedulesModule,
    SubscriptionsModule,
    StripeModule,
    RealtimeModule,
    PlayerModule,
    AdminModule,
    AccountModule,
    WebhooksModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
