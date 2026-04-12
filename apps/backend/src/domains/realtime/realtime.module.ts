import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { ScreenHeartbeatService } from './screen-heartbeat.service';

@Module({
  imports: [ConfigModule, forwardRef(() => AuthModule)],
  providers: [RealtimeGateway, ScreenHeartbeatService],
  exports: [ScreenHeartbeatService],
})
export class RealtimeModule {}
