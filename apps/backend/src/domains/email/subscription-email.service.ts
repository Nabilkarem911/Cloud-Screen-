import { Injectable, Logger } from '@nestjs/common';

/**
 * Placeholder for renewal / subscription reminders. Replace with SendGrid, SES, etc.
 */
@Injectable()
export class SubscriptionEmailService {
  private readonly log = new Logger(SubscriptionEmailService.name);

  async sendRenewalReminder(toEmail: string, fullName: string): Promise<void> {
    this.log.log(
      `[placeholder] Subscription reminder → ${toEmail} (${fullName})`,
    );
  }
}
