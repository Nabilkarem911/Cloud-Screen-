import { IsIn } from 'class-validator';

export class RemoteCommandDto {
  @IsIn(['identify', 'refresh_content', 'restart'])
  command!: 'identify' | 'refresh_content' | 'restart';
}
