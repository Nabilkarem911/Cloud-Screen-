import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { StartPairingSessionDto } from '../pairing/dto/start-pairing-session.dto';
import { PairingService } from '../pairing/pairing.service';
import { PlayerService } from './player.service';

/**
 * Unauthenticated player endpoints (kiosk). Secured with shared PLAYER_HEARTBEAT_SECRET.
 */
@Controller('player')
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly pairing: PairingService,
  ) {}

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

  /** Pairing v2: player shows `pairingCode`, dashboard claims with workspace JWT. */
  @Post('pairing/sessions')
  @HttpCode(201)
  startPairingSession(
    @Body() dto: StartPairingSessionDto,
    @Headers('x-player-secret') secret: string | undefined,
  ) {
    return this.pairing.startSession(dto, secret);
  }

  @Get('pairing/sessions/:sessionId')
  pollPairingSession(
    @Param('sessionId') sessionId: string,
    @Headers('x-pairing-poll-secret') pollSecret: string | undefined,
  ) {
    return this.pairing.pollSession(sessionId, pollSecret);
  }
}
