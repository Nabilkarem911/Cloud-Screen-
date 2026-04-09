import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCanvasDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(7680)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(240)
  @Max(4320)
  height?: number;

  @IsOptional()
  @IsObject()
  layoutData?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  durationSec?: number;
}
