import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly stripeWebhooks: StripeWebhookService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const raw: unknown = req.body;
    if (!Buffer.isBuffer(raw)) {
      throw new BadRequestException('Expected raw webhook body');
    }
    return this.stripeWebhooks.handleRawPayload(raw, signature);
  }
}
