import { Module } from '@nestjs/common';
import { CanvasesModule } from '../canvases/canvases.module';
import { MediaModule } from '../media/media.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SchedulingModule } from '../schedules/scheduling.module';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';

@Module({
  imports: [SchedulingModule, MediaModule, CanvasesModule, RealtimeModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
