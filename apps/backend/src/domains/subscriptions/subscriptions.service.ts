import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScreenHeartbeatService } from '../realtime/screen-heartbeat.service';
import { assertMockBillingAllowed } from '../../common/product/mock-billing';

const BYTES_5GB = 5 * 1024 * 1024 * 1024;
const BYTES_50GB = 50 * 1024 * 1024 * 1024;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heartbeat: ScreenHeartbeatService,
    private readonly config: ConfigService,
  ) {}

  private defaultsForPlan(plan: SubscriptionPlan): {
    seats: number;
    screenLimit: number;
    currentPeriodEnd: Date | null;
  } {
    const monthEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    switch (plan) {
      case SubscriptionPlan.FREE:
        return { seats: 5, screenLimit: 25, currentPeriodEnd: null };
      case SubscriptionPlan.STARTER:
        return { seats: 15, screenLimit: 100, currentPeriodEnd: monthEnd };
      case SubscriptionPlan.PRO:
        return { seats: 25, screenLimit: 500, currentPeriodEnd: monthEnd };
      case SubscriptionPlan.ENTERPRISE:
        return { seats: 100, screenLimit: 2000, currentPeriodEnd: monthEnd };
      default:
        return { seats: 5, screenLimit: 25, currentPeriodEnd: null };
    }
  }

  /**
   * Called after Stripe (or similar) verifies payment. Expects `workspaceId` + `plan`
   * in Checkout session metadata. Pass a transaction client when composing with other writes.
   */
  async applyTrustedCheckoutUsingClient(
    db: Prisma.TransactionClient,
    params: {
      workspaceId: string;
      plan: SubscriptionPlan;
      screenLimit?: number;
      seats?: number;
      currentPeriodEnd?: Date | null;
      storageLimitBytes?: number | null;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
    },
  ) {
    const sub = await db.subscription.findUnique({
      where: { workspaceId: params.workspaceId },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found for workspace');
    }
    const d = this.defaultsForPlan(params.plan);
    const updated = await db.subscription.update({
      where: { workspaceId: params.workspaceId },
      data: {
        plan: params.plan,
        status: SubscriptionStatus.ACTIVE,
        seats: params.seats ?? d.seats,
        screenLimit: params.screenLimit ?? d.screenLimit,
        currentPeriodEnd:
          params.currentPeriodEnd !== undefined
            ? params.currentPeriodEnd
            : d.currentPeriodEnd,
        ...(params.storageLimitBytes !== undefined
          ? { storageLimitBytes: params.storageLimitBytes }
          : {}),
        ...(params.stripeCustomerId
          ? { stripeCustomerId: params.stripeCustomerId }
          : {}),
        ...(params.stripeSubscriptionId
          ? { stripeSubscriptionId: params.stripeSubscriptionId }
          : {}),
      },
    });
    return {
      workspaceId: updated.workspaceId,
      plan: updated.plan,
      status: updated.status,
      seats: updated.seats,
      screenLimit: updated.screenLimit,
      storageLimitBytes: updated.storageLimitBytes,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      startedAt: updated.startedAt.toISOString(),
    };
  }

  async applyTrustedCheckout(params: {
    workspaceId: string;
    plan: SubscriptionPlan;
    screenLimit?: number;
    seats?: number;
    currentPeriodEnd?: Date | null;
    storageLimitBytes?: number | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }) {
    return this.applyTrustedCheckoutUsingClient(
      this.prisma as unknown as Prisma.TransactionClient,
      params,
    );
  }

  async getCurrent(workspaceId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (!sub)
      throw new NotFoundException('Subscription not found for workspace');

    return {
      workspaceId: sub.workspaceId,
      plan: sub.plan,
      status: sub.status,
      seats: sub.seats,
      screenLimit: sub.screenLimit,
      storageLimitBytes: sub.storageLimitBytes,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      startedAt: sub.startedAt.toISOString(),
      billingPortalAvailable: Boolean(sub.stripeCustomerId),
    };
  }

  async createBillingPortalSession(
    userId: string,
    workspaceId: string,
    locale?: string,
  ): Promise<{ url: string }> {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (
      !membership ||
      (membership.role !== UserRole.OWNER && membership.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException();
    }
    const sub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (!sub?.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer on file. Complete a paid checkout first.',
      );
    }
    const origin =
      this.config.get<string>('FRONTEND_ORIGIN')?.trim() ||
      'http://localhost:3000';
    const base = origin.replace(/\/$/, '');
    const lang = (locale ?? 'en').split('-')[0] || 'en';
    const returnUrl =
      this.config.get<string>('STRIPE_PORTAL_RETURN_URL')?.trim() ??
      `${base}/${lang}/settings/billing`;

    const stripe = new Stripe(secret);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });
    if (!portal.url) {
      throw new ServiceUnavailableException('Stripe portal URL missing');
    }
    return { url: portal.url };
  }

  async createStripeCheckoutSession(
    userId: string,
    workspaceId: string,
    plan: SubscriptionPlan,
  ): Promise<{ url: string | null }> {
    if (plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('Use workspace billing to stay on Free');
    }
    const secret = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (
      !membership ||
      (membership.role !== UserRole.OWNER && membership.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException();
    }
    const priceId = this.stripePriceIdForPlan(plan);
    if (!priceId) {
      throw new BadRequestException(
        `Stripe price ID not configured for plan ${plan}`,
      );
    }
    const origin =
      this.config.get<string>('FRONTEND_ORIGIN')?.trim() ||
      'http://localhost:3000';
    const base = origin.replace(/\/$/, '');
    const successUrl =
      this.config.get<string>('STRIPE_CHECKOUT_SUCCESS_URL')?.trim() ??
      `${base}/en/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      this.config.get<string>('STRIPE_CHECKOUT_CANCEL_URL')?.trim() ??
      `${base}/en/billing?checkout=canceled`;

    const existingSub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { stripeCustomerId: true },
    });

    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: workspaceId,
      ...(existingSub?.stripeCustomerId
        ? { customer: existingSub.stripeCustomerId }
        : {}),
      metadata: {
        workspace_id: workspaceId,
        plan,
      },
      subscription_data: {
        metadata: {
          workspace_id: workspaceId,
          plan,
        },
      },
    });
    return { url: session.url };
  }

  private stripePriceIdForPlan(plan: SubscriptionPlan): string | null {
    const key =
      plan === SubscriptionPlan.PRO
        ? 'STRIPE_PRICE_ID_PRO'
        : plan === SubscriptionPlan.STARTER
          ? 'STRIPE_PRICE_ID_STARTER'
          : plan === SubscriptionPlan.ENTERPRISE
            ? 'STRIPE_PRICE_ID_ENTERPRISE'
            : '';
    if (!key) return null;
    return this.config.get<string>(key)?.trim() ?? null;
  }

  /**
   * Keeps workspace subscription row aligned with Stripe subscription lifecycle events.
   */
  async syncFromStripeSubscription(
    db: Prisma.TransactionClient,
    stripeSub: Stripe.Subscription,
    cancelled: boolean,
  ): Promise<void> {
    const md = stripeSub.metadata ?? {};
    const workspaceId = (
      (md.workspace_id as string | undefined) ??
      (md.workspaceId as string | undefined)
    )?.trim();
    if (!workspaceId) {
      return;
    }
    const exists = await db.subscription.findUnique({
      where: { workspaceId },
    });
    if (!exists) return;

    let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
    if (cancelled) {
      status = SubscriptionStatus.CANCELED;
    } else if (
      stripeSub.status === 'past_due' ||
      stripeSub.status === 'unpaid'
    ) {
      status = SubscriptionStatus.PAST_DUE;
    } else if (stripeSub.status === 'canceled') {
      status = SubscriptionStatus.CANCELED;
    } else if (stripeSub.status === 'trialing') {
      status = SubscriptionStatus.TRIALING;
    } else if (stripeSub.status === 'active' || stripeSub.status === 'paused') {
      status = SubscriptionStatus.ACTIVE;
    }

    const periodEndSec = stripeSub.current_period_end;
    const currentPeriodEnd =
      typeof periodEndSec === 'number' ? new Date(periodEndSec * 1000) : null;

    const customerRef = stripeSub.customer;
    const stripeCustomerId =
      typeof customerRef === 'string'
        ? customerRef
        : customerRef && !customerRef.deleted
          ? customerRef.id
          : undefined;

    await db.subscription.update({
      where: { workspaceId },
      data: {
        status,
        currentPeriodEnd,
        canceledAt: cancelled ? new Date() : null,
        stripeSubscriptionId: stripeSub.id,
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      },
    });
  }

  async setMockPlan(workspaceId: string, plan: 'FREE' | 'PRO') {
    assertMockBillingAllowed();
    const sub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (!sub)
      throw new NotFoundException('Subscription not found for workspace');
    if (plan !== 'FREE' && plan !== 'PRO') {
      throw new BadRequestException('Unsupported plan');
    }

    const nextPlan =
      plan === 'PRO' ? SubscriptionPlan.PRO : SubscriptionPlan.FREE;
    const nextStatus =
      plan === 'PRO' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING;
    const nextSeats = plan === 'PRO' ? 25 : 5;
    const nextScreenLimit = plan === 'PRO' ? 500 : 25;
    const nextPeriodEnd =
      plan === 'PRO' ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) : null;
    const nextStorageLimit = plan === 'PRO' ? BYTES_50GB : BYTES_5GB;

    const updated = await this.prisma.subscription.update({
      where: { workspaceId },
      data: {
        plan: nextPlan,
        status: nextStatus,
        seats: nextSeats,
        screenLimit: nextScreenLimit,
        currentPeriodEnd: nextPeriodEnd,
        storageLimitBytes: nextStorageLimit,
      },
    });

    const payload = {
      workspaceId: updated.workspaceId,
      plan: updated.plan,
      status: updated.status,
      seats: updated.seats,
      screenLimit: updated.screenLimit,
      storageLimitBytes: updated.storageLimitBytes,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      startedAt: updated.startedAt.toISOString(),
      mock: true,
    };
    this.heartbeat.emitWorkspaceSubscriptionUpdated(workspaceId, payload);

    return payload;
  }
}
