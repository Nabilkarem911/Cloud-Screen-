import { IsNotEmpty, IsString } from 'class-validator';

export class ClonePlaylistDto {
  @IsString()
  @IsNotEmpty()
  targetWorkspaceId!: string;
}
