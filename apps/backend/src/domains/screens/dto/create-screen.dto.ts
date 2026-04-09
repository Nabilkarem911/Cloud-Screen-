import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
