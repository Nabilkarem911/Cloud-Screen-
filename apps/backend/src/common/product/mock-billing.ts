import { NotFoundException } from '@nestjs/common';

/** Demo subscription overrides; disabled in production unless ENABLE_MOCK_BILLING=true. */
export function assertMockBillingAllowed(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_MOCK_BILLING !== 'true'
  ) {
    throw new NotFoundException();
  }
}
