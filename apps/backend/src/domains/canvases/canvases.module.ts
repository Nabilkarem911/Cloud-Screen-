import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CanvasesController } from './canvases.controller';
import { CanvasesService } from './canvases.service';

@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [CanvasesController],
  providers: [CanvasesService],
  exports: [CanvasesService],
})
export class CanvasesModule {}
