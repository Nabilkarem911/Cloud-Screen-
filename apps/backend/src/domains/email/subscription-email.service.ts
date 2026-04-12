import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { subscriptionReminderEmail } from './email-templates';

@Injectable()
export class SubscriptionEmailService {
  private readonly log = new Logger(SubscriptionEmailService.name);

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async sendRenewalReminder(toEmail: string, fullName: string): Promise<void> {
    const origin = this.config.get<string>('FRONTEND_ORIGIN')?.trim();
    const dashboardUrl = origin
      ? `${origin.replace(/\/$/, '')}/en/overview`
      : undefined;
    const { subject, html, text } = subscriptionReminderEmail({
      fullName,
      dashboardUrl,
    });
    if (!this.email.isConfigured()) {
      this.log.warn(
        `[subscription reminder] Email not configured; would send to ${toEmail}`,
      );
      return;
    }
    await this.email.sendMail({ to: toEmail, subject, html, text });
  }
}
