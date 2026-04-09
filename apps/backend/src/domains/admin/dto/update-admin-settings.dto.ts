import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAdminSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  platformName?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrlEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrlAr?: string;
}