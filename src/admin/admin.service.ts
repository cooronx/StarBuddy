import { Injectable, NotFoundException } from '@nestjs/common';
import { RepositoryStatus, UserStatus } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  getSystemStatus() {
    return {
      starTasksEnabled: this.config.starTasksEnabled,
      repositoryPromotionEnabled: this.config.repositoryPromotionEnabled,
      adminGithubLogins: this.config.adminGithubLogins,
      cleanupIntervalMs: this.config.cleanupIntervalMs,
      githubRequestTimeoutMs: this.config.githubRequestTimeoutMs,
      serverNow: new Date().toISOString(),
    };
  }

  async listReports() {
    const reports = await this.prisma.repositoryReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        repository: {
          select: {
            id: true,
            githubOwner: true,
            githubRepo: true,
            status: true,
          },
        },
        reporter: {
          select: {
            id: true,
            githubLogin: true,
            avatarUrl: true,
          },
        },
      },
    });

    return reports.map((report) => ({
      id: report.id,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
      repository: report.repository,
      reporter: report.reporter,
    }));
  }

  archiveRepository(repositoryId: string) {
    return this.setRepositoryStatus(repositoryId, RepositoryStatus.archived);
  }

  rejectRepository(repositoryId: string) {
    return this.setRepositoryStatus(repositoryId, RepositoryStatus.rejected);
  }

  restoreRepository(repositoryId: string) {
    return this.setRepositoryStatus(repositoryId, RepositoryStatus.inactive);
  }

  async suspendUser(userId: string) {
    return this.setUserStatus(userId, UserStatus.suspended);
  }

  async unsuspendUser(userId: string) {
    return this.setUserStatus(userId, UserStatus.active);
  }

  private async setRepositoryStatus(
    repositoryId: string,
    status: RepositoryStatus,
  ) {
    const repository = await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { status },
      select: {
        id: true,
        githubOwner: true,
        githubRepo: true,
        status: true,
      },
    });

    if (
      status === RepositoryStatus.archived ||
      status === RepositoryStatus.rejected
    ) {
      await this.prisma.repositoryReport.updateMany({
        where: { repositoryId, status: 'open' },
        data: {
          status: 'resolved',
          reviewedAt: new Date(),
        },
      });
    }

    return repository;
  }

  private async setUserStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        githubLogin: true,
        status: true,
      },
    });
  }
}
