import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super();
    this.$connect().catch((error) => {
      console.error('Database connection error: ', error);
    });
  }

  async onModuleInit() {
    await this.$connect().catch((error) => {
      console.error('Failed to connect on module init: ', error);
    });
  }

  async healthCheck() {
    try {
      await this.$executeRaw`SELECT 1`;
      return { status: 'healthy' };
    } catch (error) {
      console.error('Health check failed: ', error);
      return { status: 'unhealthy' };
    }
  }

  async gracefulFallback() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn('DATABASE_URL is not set. Falling back to default configuration.');
      // Fallback handling code here
    }
  }
}