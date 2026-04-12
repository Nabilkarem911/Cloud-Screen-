import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  /** True when at least one outbound provider is configured. */
  isConfigured(): boolean {
    if (this.config.get<string>('RESEND_API_KEY')?.trim()) return true;
    if (this.config.get<string>('SENDGRID_API_KEY')?.trim()) return true;
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    return Boolean(host && user && pass);
  }

  private fromHeader(): string {
    const name =
      this.config.get<string>('EMAIL_FROM_NAME')?.trim() || 'Cloud Signage';
    const addr =
      this.config.get<string>('EMAIL_FROM')?.trim() || 'noreply@localhost';
    return `${name} <${addr}>`;
  }

  async sendMail(input: SendMailInput): Promise<void> {
    const resendKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (resendKey) {
      await this.sendViaResend(resendKey, input);
      return;
    }
    const sgKey = this.config.get<string>('SENDGRID_API_KEY')?.trim();
    if (sgKey) {
      await this.sendViaSendGrid(sgKey, input);
      return;
    }
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    if (host && user && pass) {
      await this.sendViaSmtp(host, port, user, pass, input);
      return;
    }
    throw new Error('No email provider configured');
  }

  private async sendViaResend(
    apiKey: string,
    input: SendMailInput,
  ): Promise<void> {
    const from = this.fromHeader();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`Resend error ${res.status}: ${body}`);
      throw new Error(`Resend failed: ${res.status}`);
    }
  }

  private async sendViaSendGrid(
    apiKey: string,
    input: SendMailInput,
  ): Promise<void> {
    const from = this.fromHeader();
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: this.extractEmail(from), name: this.extractName(from) },
        subject: input.subject,
        content: [
          { type: 'text/plain', value: input.text },
          { type: 'text/html', value: input.html },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`SendGrid error ${res.status}: ${body}`);
      throw new Error(`SendGrid failed: ${res.status}`);
    }
  }

  private extractEmail(from: string): string {
    const m = from.match(/<([^>]+)>/);
    return m ? m[1].trim() : from.trim();
  }

  private extractName(from: string): string {
    const m = from.match(/^(.+)<[^>]+>$/);
    return m ? m[1].trim().replace(/"/g, '') : 'Cloud Signage';
  }

  private async sendViaSmtp(
    host: string,
    port: number,
    user: string,
    pass: string,
    input: SendMailInput,
  ): Promise<void> {
    const secure =
      this.config.get<string>('SMTP_SECURE')?.trim().toLowerCase() === 'true';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: this.fromHeader(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}
