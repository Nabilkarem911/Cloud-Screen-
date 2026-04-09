import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { UserSubscriptionStatus } from '@prisma/client';

export class PatchCustomerSubscriptionDto {
  @IsOptional()
  @IsEnum(UserSubscriptionStatus)
  subscriptionStatus?: UserSubscriptionStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  subscriptionEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
