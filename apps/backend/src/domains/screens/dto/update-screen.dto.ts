import { PlayerPlatform, ScreenStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateScreenDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(ScreenStatus)
  @IsOptional()
  status?: ScreenStatus;

  @IsString()
  @IsOptional()
  activePlaylistId?: string | null;

  @IsString()
  @IsOptional()
  playerTicker?: string | null;

  @IsString()
  @IsOptional()
  playlistGroupId?: string | null;

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
}
