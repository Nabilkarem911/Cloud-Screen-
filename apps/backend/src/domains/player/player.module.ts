import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CanvasesModule } from '../canvases/canvases.module';
import { PlaylistsModule } from '../playlists/playlists.module';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

@Module({
  imports: [AuthModule, PlaylistsModule, CanvasesModule],
  controllers: [PlayerController],
  providers: [PlayerService],
})
export class PlayerModule {}
