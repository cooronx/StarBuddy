import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RepositoryStatus, StarActionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GithubService } from '../github/github.service';
import { parseGithubRepositoryUrl } from './repository-url';

const OCCUPIED_PROMOTION_STATUSES = [
  RepositoryStatus.active,
  RepositoryStatus.paused,
];

@Injectable()
export class RepositoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly github: GithubService,
  ) {}

  async create(userId: string, url: string) {
    const { owner, repo } = parseGithubRepositoryUrl(url);
    const token = await this.authService.getActiveGithubAccessToken(userId);
    const githubRepo = await this.github.getRepository(owner, repo, token);

    if (githubRepo.isPrivate) {
      throw new BadRequestException('Only public repositories are supported');
    }

    const repository = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.repository.findUnique({
        where: {
          githubOwner_githubRepo: {
            githubOwner: githubRepo.owner,
            githubRepo: githubRepo.repo,
          },
        },
      });

      if (existing && existing.ownerUserId !== userId) {
        throw new BadRequestException('Repository has already been submitted');
      }

      const occupiedSlot = await this.findOccupiedPromotionSlot(tx, userId);
      const nextStatus =
        occupiedSlot || existing?.status === RepositoryStatus.paused
          ? existing?.status ?? RepositoryStatus.inactive
          : RepositoryStatus.active;

      if (existing) {
        return tx.repository.update({
          where: { id: existing.id },
          data: {
            description: githubRepo.description,
            starsCountSnapshot: githubRepo.starsCount,
            status:
              existing.status === RepositoryStatus.inactive
                ? nextStatus
                : existing.status,
          },
          include: repositorySummaryInclude(),
        });
      }

      return tx.repository.create({
        data: {
          ownerUserId: userId,
          githubOwner: githubRepo.owner,
          githubRepo: githubRepo.repo,
          githubRepoId: githubRepo.id,
          description: githubRepo.description,
          starsCountSnapshot: githubRepo.starsCount,
          status: nextStatus,
          starTask: { create: {} },
        },
        include: repositorySummaryInclude(),
      });
    });

    return serializeRepository(repository);
  }

  async listMine(userId: string) {
    const repositories = await this.prisma.repository.findMany({
      where: { ownerUserId: userId },
      include: repositorySummaryInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return repositories.map(serializeRepository);
  }

  async listGithubMine(userId: string, githubLogin: string) {
    const token = await this.authService.getActiveGithubAccessToken(userId);
    const [githubRepositories, submittedRepositories, user] = await Promise.all([
      this.github.listPublicRepositories(githubLogin, token),
      this.prisma.repository.findMany({
        where: { ownerUserId: userId },
        include: repositorySummaryInclude(),
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { lastPromotionSwitchAt: true },
      }),
    ]);

    const submittedByGithubId = new Map(
      submittedRepositories.map((repository) => [
        repository.githubRepoId.toString(),
        serializeRepository(repository),
      ]),
    );

    return {
      repositories: githubRepositories.map((repository) => ({
        githubRepoId: repository.id.toString(),
        githubOwner: repository.owner,
        githubRepo: repository.repo,
        description: repository.description ?? null,
        starsCountSnapshot: repository.starsCount,
        submittedRepository:
          submittedByGithubId.get(repository.id.toString()) ?? null,
      })),
      promotionSwitch: serializePromotionSwitch(user.lastPromotionSwitchAt),
    };
  }

  async activate(userId: string, repositoryId: string) {
    const repository = await this.prisma.$transaction(async (tx) => {
      const target = await this.findUserRepositoryOrThrow(
        tx,
        userId,
        repositoryId,
      );

      if (target.status === RepositoryStatus.active) {
        return target;
      }

      if (target.status === RepositoryStatus.archived) {
        throw new BadRequestException('Archived repositories cannot be activated');
      }

      if (target.status === RepositoryStatus.rejected) {
        throw new BadRequestException('Rejected repositories cannot be activated');
      }

      if (target.status === RepositoryStatus.paused) {
        return tx.repository.update({
          where: { id: target.id },
          data: { status: RepositoryStatus.active },
          include: repositorySummaryInclude(),
        });
      }

      const [occupiedSlot, user] = await Promise.all([
        this.findOccupiedPromotionSlot(tx, userId),
        tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { lastPromotionSwitchAt: true },
        }),
      ]);

      const now = new Date();
      if (
        occupiedSlot &&
        occupiedSlot.id !== target.id &&
        wasPromotionSwitchUsedToday(user.lastPromotionSwitchAt, now)
      ) {
        throw new BadRequestException(
          'Promotion switch is available once per server-local day',
        );
      }

      if (occupiedSlot && occupiedSlot.id !== target.id) {
        await tx.repository.update({
          where: { id: occupiedSlot.id },
          data: { status: RepositoryStatus.inactive },
        });
        await tx.user.update({
          where: { id: userId },
          data: { lastPromotionSwitchAt: now },
        });
      }

      return tx.repository.update({
        where: { id: target.id },
        data: { status: RepositoryStatus.active },
        include: repositorySummaryInclude(),
      });
    });

    return serializeRepository(repository);
  }

  async pause(userId: string, repositoryId: string) {
    const repository = await this.prisma.$transaction(async (tx) => {
      const target = await this.findUserRepositoryOrThrow(
        tx,
        userId,
        repositoryId,
      );

      if (target.status === RepositoryStatus.paused) {
        return target;
      }

      if (target.status !== RepositoryStatus.active) {
        throw new BadRequestException('Only active repositories can be paused');
      }

      return tx.repository.update({
        where: { id: target.id },
        data: { status: RepositoryStatus.paused },
        include: repositorySummaryInclude(),
      });
    });

    return serializeRepository(repository);
  }

  async resume(userId: string, repositoryId: string) {
    const repository = await this.prisma.$transaction(async (tx) => {
      const target = await this.findUserRepositoryOrThrow(
        tx,
        userId,
        repositoryId,
      );

      if (target.status === RepositoryStatus.active) {
        return target;
      }

      if (target.status !== RepositoryStatus.paused) {
        throw new BadRequestException('Only paused repositories can be resumed');
      }

      return tx.repository.update({
        where: { id: target.id },
        data: { status: RepositoryStatus.active },
        include: repositorySummaryInclude(),
      });
    });

    return serializeRepository(repository);
  }

  private findOccupiedPromotionSlot(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    return tx.repository.findFirst({
      where: {
        ownerUserId: userId,
        status: { in: OCCUPIED_PROMOTION_STATUSES },
      },
      orderBy: { createdAt: 'asc' },
      include: repositorySummaryInclude(),
    });
  }

  private async findUserRepositoryOrThrow(
    tx: Prisma.TransactionClient,
    userId: string,
    repositoryId: string,
  ) {
    const repository = await tx.repository.findFirst({
      where: { id: repositoryId, ownerUserId: userId },
      include: repositorySummaryInclude(),
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    return repository;
  }
}

function serializeRepository(repository: {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubRepoId: bigint;
  description: string | null;
  starsCountSnapshot: number;
  status: string;
  starTask?: { id: string; status: string } | null;
  starActions?: {
    id: string;
    createdAt: Date;
    actor: {
      id: string;
      githubLogin: string;
      avatarUrl: string | null;
    };
  }[];
  _count?: {
    starActions: number;
  };
}) {
  return {
    id: repository.id,
    githubOwner: repository.githubOwner,
    githubRepo: repository.githubRepo,
    githubRepoId: repository.githubRepoId.toString(),
    description: repository.description,
    starsCountSnapshot: repository.starsCountSnapshot,
    status: repository.status,
    starTask: repository.starTask
      ? {
          id: repository.starTask.id,
          status: repository.starTask.status,
        }
      : null,
    starBuddyStarsCount: repository._count?.starActions ?? 0,
    recentStars:
      repository.starActions?.map((action) => ({
        id: action.id,
        starredAt: action.createdAt,
        actor: {
          id: action.actor.id,
          githubLogin: action.actor.githubLogin,
          avatarUrl: action.actor.avatarUrl,
        },
      })) ?? [],
  };
}

function repositorySummaryInclude() {
  return {
    starTask: true,
    starActions: {
      where: { status: StarActionStatus.completed_rewarded },
      include: {
        actor: {
          select: {
            id: true,
            githubLogin: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' as const },
      take: 10,
    },
    _count: {
      select: {
        starActions: {
          where: { status: StarActionStatus.completed_rewarded },
        },
      },
    },
  };
}

function serializePromotionSwitch(
  lastPromotionSwitchAt: Date | null,
  now = new Date(),
) {
  const switchUsedToday = wasPromotionSwitchUsedToday(
    lastPromotionSwitchAt,
    now,
  );

  return {
    canSwitch: !switchUsedToday,
    switchUsedToday,
    lastSwitchedAt: lastPromotionSwitchAt?.toISOString() ?? null,
    serverNow: now.toISOString(),
    nextSwitchResetAt: nextServerLocalMidnight(now).toISOString(),
  };
}

function wasPromotionSwitchUsedToday(
  lastPromotionSwitchAt: Date | null,
  now = new Date(),
) {
  if (!lastPromotionSwitchAt) {
    return false;
  }

  return (
    lastPromotionSwitchAt.getFullYear() === now.getFullYear() &&
    lastPromotionSwitchAt.getMonth() === now.getMonth() &&
    lastPromotionSwitchAt.getDate() === now.getDate()
  );
}

function nextServerLocalMidnight(now: Date) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
}
