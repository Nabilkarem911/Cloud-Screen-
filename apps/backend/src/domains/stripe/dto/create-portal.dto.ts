import { IsOptional, IsString, Matches } from 'class-validator';

export class CreatePortalDto {
  @IsString()
  workspaceId!: string;

  /** Used to build the Stripe return URL: `/{locale}/settings/billing`. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  locale?: string;
}
