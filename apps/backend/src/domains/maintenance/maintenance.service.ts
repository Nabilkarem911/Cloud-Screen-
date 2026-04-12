import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Purge pairing sessions past expiry (runs once per day, UTC). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredPairingSessions(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.screenPairingSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (result.count > 0) {
      this.logger.log(
        `Deleted ${result.count} expired ScreenPairingSession row(s) (expiresAt < now).`,
      );
    }
  }
}
