import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  it('isConfigured is false when no provider env', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();
    const svc = mod.get(EmailService);
    expect(svc.isConfigured()).toBe(false);
  });

  it('isConfigured is true when RESEND_API_KEY set', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'RESEND_API_KEY' ? 're_test' : undefined,
          },
        },
      ],
    }).compile();
    const svc = mod.get(EmailService);
    expect(svc.isConfigured()).toBe(true);
  });
});
