import { ScreenStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListScreensDto {
  @IsString()
  workspaceId!: string;

  @IsEnum(ScreenStatus)
  @IsOptional()
  status?: ScreenStatus;

  @IsString()
  @IsOptional()
  playlistGroupId?: string;

  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  @IsOptional()
  ungrouped?: boolean;

  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  limit = 12;
}
