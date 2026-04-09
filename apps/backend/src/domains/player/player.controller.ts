import { Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PlayerService } from './player.service';

/**
 * Unauthenticated player endpoints (kiosk). Secured with shared PLAYER_HEARTBEAT_SECRET.
 */
@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('bootstrap')
  async bootstrap(
    @Query('serialNumber') serialNumber: string | undefined,
    @Headers('x-player-secret') secret: string | undefined,
  ) {
    return this.playerService.getBootstrap(serialNumber, secret);
  }

  /** JWT (Bearer): first screen in workspace — for player app synced with dashboard login. */
  @UseGuards(JwtAuthGuard)
  @Get('workspace-bootstrap')
  async workspaceBootstrap(
    @CurrentUser() user: JwtUser,
    @Query('workspaceId') workspaceId: string | undefined,
    @Query('workspaceName') workspaceName: string | undefined,
  ) {
    return this.playerService.getBootstrapForAuthenticatedUser(
      user,
      workspaceId,
      workspaceName,
    );
  }

  @Get('canvas/:canvasId')
  async compiledCanvas(
    @Param('canvasId') canvasId: string,
    @Query('serialNumber') serialNumber: string | undefined,
    @Headers('x-player-secret') secret: string | undefined,
  ) {
    return this.playerService.getCompiledCanvas(serialNumber, secret, canvasId);
  }
}
