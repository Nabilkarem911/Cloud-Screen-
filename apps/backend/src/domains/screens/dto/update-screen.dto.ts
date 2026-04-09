import { ScreenStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
}
