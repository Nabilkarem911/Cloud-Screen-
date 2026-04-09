import { IsNotEmpty, IsString } from 'class-validator';

export class RenamePlaylistDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
