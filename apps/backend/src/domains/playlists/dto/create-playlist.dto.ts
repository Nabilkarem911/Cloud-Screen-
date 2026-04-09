import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePlaylistDto {
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
