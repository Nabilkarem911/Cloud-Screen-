import { PlatformStaffRole, UserSubscriptionStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  @IsOptional()
  @IsEnum(PlatformStaffRole)
  platformStaffRole?: PlatformStaffRole | null;

  @IsOptional()
  @IsEnum(UserSubscriptionStatus)
  subscriptionStatus?: UserSubscriptionStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  subscriptionEndDate?: string | null;
}
