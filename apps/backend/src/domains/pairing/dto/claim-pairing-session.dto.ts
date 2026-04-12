import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class ClaimPairingSessionDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;
}
