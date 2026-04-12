import { PlayerPlatform } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StartPairingSessionDto {
  @IsEnum(PlayerPlatform)
  @IsOptional()
  playerPlatform?: PlayerPlatform;

  @IsInt()
  @Min(320)
  @Max(7680)
  @IsOptional()
  resolutionWidth?: number;

  @IsInt()
  @Min(240)
  @Max(4320)
  @IsOptional()
  resolutionHeight?: number;

  /** When set with valid `x-player-secret`, notifies this workspace over Socket.IO (`pairing:started`). */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  workspaceId?: string;
}
