import path from 'path';
import { config } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

config({ path: path.resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ['konva', 'react-konva'],
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl(nextConfig);
