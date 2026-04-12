import { PlayerPlatform } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateScreenDto {
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @IsString()
  @IsOptional()
  location?: string;

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
