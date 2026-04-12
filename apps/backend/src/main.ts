import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';
import express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  if (process.env.DATABASE_URL?.trim()) {
    console.log('Database connection attempt...');
  } else {
    console.warn('DATABASE_URL is not set; Prisma/database features will fail.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const http = app.getHttpAdapter().getInstance();
  http.use(
    '/api/v1/webhooks/stripe',
    express.raw({ type: 'application/json' }),
  );
  http.use(express.json({ limit: '50mb' }));
  http.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/media-files/',
    setHeaders: (res: Response) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  const fromList =
    process.env.FRONTEND_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
  const single = process.env.FRONTEND_ORIGIN?.trim();
  /** Local dev: `localhost` and `127.0.0.1` are different Origins — allow both so fetch + cookies work. */
  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  const allowedOrigins = [
    ...new Set([
      ...fromList,
      ...(single ? [single] : []),
      ...defaultDevOrigins,
    ]),
  ].filter(Boolean);
  /** When true, reflect the request `Origin` (needed for Docker / raw IP hostnames not listed in FRONTEND_ORIGINS). */
  const trustDynamicCors =
    process.env.TRUST_DYNAMIC_CORS === 'true' ||
    process.env.TRUST_DYNAMIC_CORS === '1';
  app.enableCors({
    origin: trustDynamicCors ? true : allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'Accept',
      'Accept-Language',
      'X-Pairing-Poll-Secret',
      'X-Player-Secret',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
