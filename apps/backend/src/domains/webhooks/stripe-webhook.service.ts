import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private parsePlan(raw: string | undefined): SubscriptionPlan | null {
    if (!raw?.trim()) return null;
    const v = raw.trim().toUpperCase() as SubscriptionPlan;
    return Object.values(SubscriptionPlan).includes(v) ? v : null;
  }

  private parseIntMd(value: string | undefined): number | undefined {
    if (value === undefined || value === '') return undefined;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  async handleRawPayload(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: true; duplicate?: boolean }> {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret?.trim()) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET is not set; refusing webhook');
      throw new ServiceUnavailableException(
        'Stripe webhooks are not configured',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.warn(`Stripe signature verification failed: ${String(err)}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({
          data: { provider: 'stripe', externalId: event.id },
        });

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const md = session.metadata ?? {};
          const workspaceId = (md.workspace_id ?? md.workspaceId)?.trim();
          const plan = this.parsePlan(md.plan ?? md.subscription_plan);
          if (workspaceId && plan) {
            const screenLimit = this.parseIntMd(
              md.screen_limit ?? md.screenLimit,
            );
            const seats = this.parseIntMd(md.seats);
            const storageLimitBytes = this.parseIntMd(
              md.storage_limit_bytes ?? md.storageLimitBytes,
            );

            let currentPeriodEnd: Date | null | undefined;
            const endRaw = md.current_period_end ?? md.currentPeriodEnd;
            if (endRaw) {
              const d = new Date(endRaw);
              currentPeriodEnd = Number.isNaN(d.getTime()) ? undefined : d;
            }

            const customerId =
              typeof session.customer === 'string'
                ? session.customer
                : session.customer?.id;
            const subscriptionId =
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription &&
                    typeof session.subscription === 'object'
                  ? (session.subscription as { id?: string }).id
                  : undefined;

            await this.subscriptions.applyTrustedCheckoutUsingClient(tx, {
              workspaceId,
              plan,
              screenLimit,
              seats,
              currentPeriodEnd,
              storageLimitBytes,
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId ?? undefined,
            });
          } else {
            this.logger.warn(
              'checkout.session.completed missing workspace_id or plan in metadata',
            );
          }
        } else if (
          event.type === 'customer.subscription.updated' ||
          event.type === 'customer.subscription.deleted'
        ) {
          const stripeSub = event.data.object;
          await this.subscriptions.syncFromStripeSubscription(
            tx,
            stripeSub,
            event.type === 'customer.subscription.deleted',
          );
        }
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return { received: true, duplicate: true };
      }
      throw e;
    }

    return { received: true };
  }
}
