import path from 'path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

config({ path: path.resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {};

export default nextConfig;
