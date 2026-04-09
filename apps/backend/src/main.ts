import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/media-files/',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  const fromList =
    process.env.FRONTEND_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
  const single = process.env.FRONTEND_ORIGIN?.trim();
  const allowedOrigins = [
    ...new Set([
      ...fromList,
      ...(single ? [single] : []),
      'http://localhost:3000',
      'http://localhost:3001',
    ]),
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'Accept',
      'Accept-Language',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
