import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { StripeWebhookService } from './stripe-webhook.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

jest.mock('stripe', () => ({
  __esModule: true,
  default: class StripeMock {
    static webhooks = { constructEvent: jest.fn() };
  },
}));

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;
  let applyTrusted: jest.Mock;
  let prismaTx: {
    processedWebhookEvent: { create: jest.Mock };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (Stripe.webhooks.constructEvent as jest.Mock).mockReset();
    applyTrusted = jest.fn().mockResolvedValue({});
    prismaTx = {
      processedWebhookEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(
        async (fn: (tx: typeof prismaTx) => Promise<void>) => {
          await fn(prismaTx);
        },
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: ConfigService, useValue: { get: () => 'whsec_test' } },
        { provide: PrismaService, useValue: prisma },
        {
          provide: SubscriptionsService,
          useValue: { applyTrustedCheckoutUsingClient: applyTrusted },
        },
      ],
    }).compile();
    service = moduleRef.get(StripeWebhookService);
  });

  it('passes Stripe customer and subscription ids on checkout.session.completed', async () => {
    (Stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { workspace_id: 'ws_1', plan: 'PRO' },
          customer: 'cus_123',
          subscription: 'sub_456',
        },
      },
    });
    await service.handleRawPayload(Buffer.from('{}'), 'sig');

    expect(applyTrusted).toHaveBeenCalledWith(
      prismaTx,
      expect.objectContaining({
        workspaceId: 'ws_1',
        plan: 'PRO',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
      }),
    );
  });

  it('returns duplicate when event id already processed', async () => {
    (Stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { workspace_id: 'ws_1', plan: 'PRO' },
          customer: 'cus_x',
          subscription: 'sub_y',
        },
      },
    });
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate webhook', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: ConfigService, useValue: { get: () => 'whsec_test' } },
        { provide: PrismaService, useValue: prisma },
        {
          provide: SubscriptionsService,
          useValue: { applyTrustedCheckoutUsingClient: applyTrusted },
        },
      ],
    }).compile();
    const dupService = moduleRef.get(StripeWebhookService);
    const out = await dupService.handleRawPayload(Buffer.from('{}'), 'sig');
    expect(out).toEqual({ received: true, duplicate: true });
  });
});
