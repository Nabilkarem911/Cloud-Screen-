import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      console.log('Prisma: connected to database.');
    } catch (err) {
      console.error(
        'Prisma: $connect failed (HTTP server still starts; retry on first query):',
        err,
      );
    }
  }
}
