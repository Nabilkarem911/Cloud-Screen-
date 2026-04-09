import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OverrideScreenDto {
  /** Set a playlist id to force now; pass `null` to clear the override. */
  @IsOptional()
  @IsString()
  playlistId?: string | null;

  /** How long the override lasts (default 8 hours). Ignored when clearing. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  @Type(() => Number)
  durationMinutes?: number;
}
