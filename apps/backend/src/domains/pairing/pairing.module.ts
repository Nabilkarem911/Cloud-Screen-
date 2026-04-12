import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PairingService } from './pairing.service';

@Module({
  imports: [RealtimeModule],
  providers: [PairingService],
  exports: [PairingService],
})
export class PairingModule {}
