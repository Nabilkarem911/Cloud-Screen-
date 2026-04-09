import { IsOptional, IsString } from 'class-validator';

export class ImpersonateUserDto {
  /** If set, that workspace is listed first after impersonation (must be a membership of the target user). */
  @IsOptional()
  @IsString()
  workspaceId?: string;
}
