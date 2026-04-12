import { IsEnum, IsString } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class CreateCheckoutDto {
  @IsString()
  workspaceId!: string;

  @IsEnum(SubscriptionPlan, {
    message: 'plan must be a valid SubscriptionPlan',
  })
  plan!: SubscriptionPlan;
}
