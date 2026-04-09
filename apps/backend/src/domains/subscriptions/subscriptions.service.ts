import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(workspaceId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (!sub) throw new NotFoundException('Subscription not found for workspace');

    return {
      workspaceId: sub.workspaceId,
      plan: sub.plan,
      status: sub.status,
      seats: sub.seats,
      screenLimit: sub.screenLimit,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      startedAt: sub.startedAt.toISOString(),
    };
  }
}
