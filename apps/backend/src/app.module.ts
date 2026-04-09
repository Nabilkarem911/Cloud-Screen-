import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CsrfModule } from './common/csrf/csrf.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './domains/auth/auth.module';
import { WorkspacesModule } from './domains/workspaces/workspaces.module';
import { ScreensModule } from './domains/screens/screens.module';
import { CanvasesModule } from './domains/canvases/canvases.module';
import { PlaylistsModule } from './domains/playlists/playlists.module';
import { SubscriptionsModule } from './domains/subscriptions/subscriptions.module';
import { RealtimeModule } from './domains/realtime/realtime.module';
import { MediaModule } from './domains/media/media.module';
import { PlayerModule } from './domains/player/player.module';
import { SchedulesModule } from './domains/schedules/schedules.module';
import { AdminModule } from './domains/admin/admin.module';
import { AccountModule } from './domains/account/account.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    RealtimeModule,
    PlayerModule,
    AdminModule,
    AccountModule,
  ],
})
export class AppModule {}
