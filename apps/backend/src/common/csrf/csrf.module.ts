import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CsrfController } from './csrf.controller';
import { CsrfMiddleware } from './csrf.middleware';

@Module({
  controllers: [CsrfController],
})
export class CsrfModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
