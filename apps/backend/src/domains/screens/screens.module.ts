import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/auth/roles.guard';
import { PlaylistsModule } from '../playlists/playlists.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SchedulingModule } from '../schedules/scheduling.module';
import { ScreensController } from './screens.controller';
import { ScreensService } from './screens.service';

@Module({
  imports: [PlaylistsModule, RealtimeModule, SchedulingModule],
  controllers: [ScreensController],
  providers: [ScreensService, RolesGuard],
})
export class ScreensModule {}
