import { Injectable, OnModuleInit } from '@nestjs/common';
import { TaskClaimStatus } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MaintenanceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit() {
    const interval = setInterval(() => {
      void this.cleanupExpiredData();
    }, this.config.cleanupIntervalMs);
    interval.unref();
  }

  async cleanupExpiredData() {
    const oauthCutoff = daysAgo(1);
    const rateLimitCutoff = daysAgo(7);
    const failedClaimCutoff = daysAgo(30);
    const reportCutoff = daysAgo(180);

    const [oauthLoginCodes, rateLimitEvents, taskClaims, repositoryReports] =
      await Promise.all([
        this.prisma.oauthLoginCode.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: oauthCutoff } },
              { consumedAt: { lt: oauthCutoff } },
            ],
          },
        }),
        this.prisma.rateLimitEvent.deleteMany({
          where: { createdAt: { lt: rateLimitCutoff } },
        }),
        this.prisma.taskClaim.deleteMany({
          where: {
            status: {
              in: [
                TaskClaimStatus.expired,
                TaskClaimStatus.skipped,
                TaskClaimStatus.failed,
                TaskClaimStatus.cancelled_daily_limit,
                TaskClaimStatus.cancelled_repository_unavailable,
              ],
            },
            OR: [
              { completedAt: { lt: failedClaimCutoff } },
              { completedAt: null, claimedAt: { lt: failedClaimCutoff } },
            ],
          },
        }),
        this.prisma.repositoryReport.deleteMany({
          where: {
            status: { not: 'open' },
            reviewedAt: { lt: reportCutoff },
          },
        }),
      ]);

    return {
      oauthLoginCodes: oauthLoginCodes.count,
      rateLimitEvents: rateLimitEvents.count,
      taskClaims: taskClaims.count,
      repositoryReports: repositoryReports.count,
      cleanedAt: new Date().toISOString(),
    };
  }
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
