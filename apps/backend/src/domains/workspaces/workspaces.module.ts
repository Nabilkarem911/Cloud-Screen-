import { Module, forwardRef } from '@nestjs/common';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PairingModule } from '../pairing/pairing.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MediaModule,
    PairingModule,
    RealtimeModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, RolesGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
