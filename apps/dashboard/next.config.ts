import path from 'path';
import { config } from 'dotenv';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

config({ path: path.resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ['konva', 'react-konva'],
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withIntl = withNextIntl(nextConfig);

const sentryDsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
  process.env.SENTRY_DSN?.trim();

export default sentryDsn
  ? withSentryConfig(withIntl, { silent: true })
  : withIntl;
