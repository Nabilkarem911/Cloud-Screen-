function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function registerOtpEmail(params: {
  code: string;
  brandName?: string;
}): { subject: string; html: string; text: string } {
  const brand = params.brandName ?? 'Cloud Signage';
  const subject = `${brand}: your verification code`;
  const html = `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:0.2em">${esc(params.code)}</p><p>This code expires in 15 minutes.</p>`;
  const text = `Your verification code is: ${params.code}\nThis code expires in 15 minutes.`;
  return { subject, html, text };
}

export function passwordResetEmail(params: {
  resetUrl: string;
  brandName?: string;
}): { subject: string; html: string; text: string } {
  const brand = params.brandName ?? 'Cloud Signage';
  const subject = `${brand}: reset your password`;
  const url = esc(params.resetUrl);
  const html = `<p>We received a request to reset your password.</p><p><a href="${url}">Set a new password</a></p><p>If you did not request this, you can ignore this email.</p><p style="word-break:break-all;color:#666">${url}</p>`;
  const text = `Reset your password: ${params.resetUrl}\nIf you did not request this, ignore this email.`;
  return { subject, html, text };
}

export function emailChangeOtpEmail(params: {
  code: string;
  brandName?: string;
}): { subject: string; html: string; text: string } {
  const brand = params.brandName ?? 'Cloud Signage';
  const subject = `${brand}: confirm your new email`;
  const html = `<p>Your verification code for the new email address is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:0.2em">${esc(params.code)}</p><p>This code expires in 15 minutes.</p>`;
  const text = `Your verification code for the new email is: ${params.code}\nThis code expires in 15 minutes.`;
  return { subject, html, text };
}

export function subscriptionReminderEmail(params: {
  fullName: string;
  brandName?: string;
  dashboardUrl?: string;
}): { subject: string; html: string; text: string } {
  const brand = params.brandName ?? 'Cloud Signage';
  const subject = `${brand}: subscription reminder`;
  const name = esc(params.fullName);
  const dash = params.dashboardUrl
    ? `<p><a href="${esc(params.dashboardUrl)}">Open dashboard</a></p>`
    : '';
  const html = `<p>Hi ${name},</p><p>This is a friendly reminder about your ${brand} subscription. Please review billing in your dashboard.</p>${dash}`;
  const text = `Hi ${params.fullName},\n\nThis is a reminder about your ${brand} subscription. Please review billing in your dashboard.${
    params.dashboardUrl ? `\n\n${params.dashboardUrl}` : ''
  }`;
  return { subject, html, text };
}
