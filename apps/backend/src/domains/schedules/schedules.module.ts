import { Module, forwardRef } from '@nestjs/common';
import { PlaylistsModule } from '../playlists/playlists.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SchedulingModule } from './scheduling.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    SchedulingModule,
    RealtimeModule,
    forwardRef(() => PlaylistsModule),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService, SchedulingModule],
})
export class SchedulesModule {}
