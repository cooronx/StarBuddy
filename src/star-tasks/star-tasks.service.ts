import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreditReason,
  Prisma,
  RepositoryStatus,
  StarActionStatus,
  TaskClaimStatus,
  UserStatus,
} from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { GITHUB_CLIENT, GithubService } from '../github/github.service';

const CLAIM_TTL_MINUTES = 10;
const USER_DAILY_REWARDED_LIMIT = 30;
const REPOSITORY_DAILY_REWARDED_LIMIT = 30;

interface CandidateTask {
  id: string;
  repository_id: string;
}

interface LockedClaim {
  id: string;
  status: TaskClaimStatus;
  task_id: string;
}

type TaskBlockStatus =
  | 'tasks_disabled'
  | 'account_suspended'
  | 'daily_user_limit_reached';

type SettleResult =
  | { credited: true; status: 'completed_rewarded' }
  | { credited: false; status: string };

@Injectable()
export class StarTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    @Inject(GITHUB_CLIENT)
    private readonly github: GithubService,
    private readonly config: AppConfigService,
  ) {}

  async executeNext(userId: string) {
    const blockStatus = await this.getTaskBlockStatus(userId);
    if (blockStatus) {
      return { status: blockStatus };
    }

    const claim = await this.claimNextTask(userId);
    if (!claim) {
      return { status: 'no_task_available' };
    }

    return this.performClaim(userId, claim.id);
  }

  async getCurrent(userId: string) {
    const existingClaim = await this.prisma.taskClaim.findFirst({
      where: {
        userId,
        status: TaskClaimStatus.claimed,
        expiresAt: { gt: new Date() },
      },
      include: {
        task: true,
        repository: true,
      },
      orderBy: { claimedAt: 'desc' },
    });

    const blockStatus = await this.getTaskBlockStatus(userId);
    if (blockStatus) {
      return { status: blockStatus };
    }

    if (existingClaim) {
      return serializeCurrentClaim(existingClaim);
    }

    const claim = await this.claimNextTask(userId);
    if (!claim) {
      return { status: 'no_task_available' };
    }

    const loadedClaim = await this.prisma.taskClaim.findUniqueOrThrow({
      where: { id: claim.id },
      include: {
        task: true,
        repository: true,
      },
    });

    return serializeCurrentClaim(loadedClaim);
  }

  async starClaim(userId: string, claimId: string) {
    const blockStatus = await this.getTaskBlockStatus(userId);
    if (blockStatus) {
      return { status: blockStatus, claimId };
    }

    return this.performClaim(userId, claimId);
  }

  async skipClaim(userId: string, claimId: string) {
    await this.authService.assertUserActive(userId);

    const claim = await this.prisma.taskClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim || claim.userId !== userId) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status !== TaskClaimStatus.claimed) {
      return { status: claim.status };
    }

    await this.prisma.taskClaim.update({
      where: { id: claimId },
      data: {
        status: TaskClaimStatus.skipped,
        completedAt: new Date(),
      },
    });

    return { status: 'skipped' };
  }

  private async performClaim(userId: string, claimId: string) {
    const claim = await this.prisma.taskClaim.findUnique({
      where: { id: claimId },
      include: { repository: { include: { owner: true } } },
    });

    if (!claim || claim.userId !== userId) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status !== TaskClaimStatus.claimed) {
      return { status: claim.status };
    }

    if (claim.expiresAt <= new Date()) {
      await this.prisma.taskClaim.update({
        where: { id: claimId },
        data: {
          status: TaskClaimStatus.expired,
          completedAt: new Date(),
        },
      });

      return { status: 'claim_expired' };
    }

    const token = await this.authService.getActiveGithubAccessToken(userId);
    const repository = claim.repository;

    if (repository.ownerUserId === userId) {
      throw new ForbiddenException('Cannot star your own repository');
    }

    const availability = await this.checkClaimAvailability(
      claim.id,
      userId,
      repository.id,
      repository.ownerUserId,
    );
    if (availability) {
      return {
        status: availability,
        repository: `${repository.githubOwner}/${repository.githubRepo}`,
        claimId,
        actorCreditDelta: 0,
        ownerCreditDelta: 0,
      };
    }

    const alreadyStarred = await this.withGithubAuthorizationInvalidation(
      userId,
      () =>
        this.github.isStarred(
          repository.githubOwner,
          repository.githubRepo,
          token,
        ),
    );

    if (alreadyStarred) {
      await this.recordNoReward(claim.id, userId, repository.id);
      return {
        status: 'already_starred_no_reward',
        repository: `${repository.githubOwner}/${repository.githubRepo}`,
        claimId,
        actorCreditDelta: 0,
        ownerCreditDelta: 0,
      };
    }

    await this.withGithubAuthorizationInvalidation(userId, () =>
      this.github.starRepository(
        repository.githubOwner,
        repository.githubRepo,
        token,
      ),
    );

    const verified = await this.withGithubAuthorizationInvalidation(
      userId,
      () =>
        this.github.isStarred(
          repository.githubOwner,
          repository.githubRepo,
          token,
        ),
    );

    if (!verified) {
      await this.markClaimFailed(claim.id);
      return {
        status: 'failed_not_verified',
        repository: `${repository.githubOwner}/${repository.githubRepo}`,
        claimId,
      };
    }

    const settled = await this.settleReward(claim.id, userId, repository);
    if (settled.status === 'cancelled_insufficient_credits') {
      return {
        status: 'completed_unrewarded_insufficient_credits',
        repository: `${repository.githubOwner}/${repository.githubRepo}`,
        claimId,
        actorCreditDelta: 0,
        ownerCreditDelta: 0,
      };
    }

    if (settled.status === 'completed_rewarded' && !settled.credited) {
      return {
        status: 'already_completed',
        repository: `${repository.githubOwner}/${repository.githubRepo}`,
        claimId,
        actorCreditDelta: 0,
        ownerCreditDelta: 0,
      };
    }

    if (settled.status !== 'completed_rewarded') {
      return {
        status: settled.status,
        repository: `${repository.githubOwner}/${repository.githubRepo}`,
        claimId,
        actorCreditDelta: 0,
        ownerCreditDelta: 0,
      };
    }

    return {
      status: 'completed_rewarded',
      repository: `${repository.githubOwner}/${repository.githubRepo}`,
      claimId,
      actorCreditDelta: 1,
      ownerCreditDelta: -1,
    };
  }

  private async claimNextTask(userId: string) {
    const { start, end } = serverLocalDayRange();

    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<CandidateTask[]>`
        select st.id, st.repository_id
        from star_tasks st
        join repositories r on r.id = st.repository_id
        join users owner on owner.id = r.owner_user_id
        left join lateral (
          select
            count(*) filter (
              where sa.status = 'completed_rewarded'
            )::int as rewarded_star_count,
            max(sa.created_at) filter (
              where sa.status = 'completed_rewarded'
            ) as last_rewarded_at,
            count(*) filter (
              where sa.status = 'completed_rewarded'
                and sa.created_at >= ${start}
                and sa.created_at < ${end}
            )::int as rewarded_star_count_today
          from star_actions sa
          where sa.repository_id = r.id
        ) metrics on true
        where st.status = 'active'
          and r.status = 'active'
          and owner.status = 'active'
          and r.owner_user_id <> ${userId}
          and owner.credits_balance > 0
          and metrics.rewarded_star_count_today < ${REPOSITORY_DAILY_REWARDED_LIMIT}
          and not exists (
            select 1
            from star_actions sa
            where sa.actor_user_id = ${userId}
              and sa.repository_id = r.id
          )
          and not exists (
            select 1
            from task_claims tc
            where tc.user_id = ${userId}
              and tc.repository_id = r.id
              and tc.status = 'claimed'
              and tc.expires_at > now()
          )
        order by
          metrics.rewarded_star_count asc,
          metrics.last_rewarded_at asc nulls first,
          st.created_at asc
        limit 1
        for update of st skip locked
      `;

      const candidate = candidates[0];
      if (!candidate) {
        return null;
      }

      return tx.taskClaim.create({
        data: {
          taskId: candidate.id,
          repositoryId: candidate.repository_id,
          userId,
          expiresAt: minutesFromNow(CLAIM_TTL_MINUTES),
        },
      });
    });
  }

  private async recordNoReward(
    claimId: string,
    actorUserId: string,
    repositoryId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.taskClaim.findUniqueOrThrow({
        where: { id: claimId },
        include: { repository: true },
      });

      await tx.starAction.upsert({
        where: {
          actorUserId_repositoryId: {
            actorUserId,
            repositoryId,
          },
        },
        create: {
          taskId: claim.taskId,
          repositoryId,
          actorUserId,
          githubOwner: claim.repository.githubOwner,
          githubRepo: claim.repository.githubRepo,
          status: StarActionStatus.already_starred_no_reward,
          githubVerifiedAt: new Date(),
        },
        update: {},
      });

      await tx.taskClaim.update({
        where: { id: claimId },
        data: {
          status: TaskClaimStatus.completed_no_reward,
          completedAt: new Date(),
        },
      });
    });
  }

  private async markClaimFailed(claimId: string) {
    await this.prisma.taskClaim.update({
      where: { id: claimId },
      data: {
        status: TaskClaimStatus.failed,
        completedAt: new Date(),
      },
    });
  }

  private async settleReward(
    claimId: string,
    actorUserId: string,
    repository: {
      id: string;
      ownerUserId: string;
      githubOwner: string;
      githubRepo: string;
    },
  ): Promise<SettleResult> {
    return this.prisma.$transaction(async (tx) => {
      const [lockedClaim] = await tx.$queryRaw<LockedClaim[]>`
        select id, status, task_id
        from task_claims
        where id = ${claimId}
        for update
      `;

      if (!lockedClaim) {
        return { credited: false, status: 'failed' };
      }

      if (lockedClaim.status !== TaskClaimStatus.claimed) {
        return { credited: false, status: lockedClaim.status };
      }

      await tx.$queryRaw`
        select id
        from users
        where id in (${actorUserId}, ${repository.ownerUserId})
        for update
      `;

      await tx.$queryRaw`
        select id
        from repositories
        where id = ${repository.id}
        for update
      `;

      const [actor, owner, currentRepository] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: actorUserId },
          select: { status: true },
        }),
        tx.user.findUniqueOrThrow({
          where: { id: repository.ownerUserId },
          select: { status: true },
        }),
        tx.repository.findUniqueOrThrow({
          where: { id: repository.id },
          select: { status: true },
        }),
      ]);

      if (
        actor.status !== UserStatus.active ||
        owner.status !== UserStatus.active ||
        currentRepository.status !== RepositoryStatus.active
      ) {
        await tx.taskClaim.update({
          where: { id: claimId },
          data: {
            status: TaskClaimStatus.cancelled_repository_unavailable,
            completedAt: new Date(),
          },
        });
        return {
          credited: false,
          status: 'cancelled_repository_unavailable',
        };
      }

      const limitStatus = await this.getDailyLimitStatus(
        tx,
        actorUserId,
        repository.id,
      );
      if (limitStatus) {
        await tx.taskClaim.update({
          where: { id: claimId },
          data: {
            status: TaskClaimStatus.cancelled_daily_limit,
            completedAt: new Date(),
          },
        });
        return { credited: false, status: 'cancelled_daily_limit' };
      }

      const ownerCharged = await tx.user.updateMany({
        where: {
          id: repository.ownerUserId,
          creditsBalance: { gte: 1 },
          status: UserStatus.active,
        },
        data: { creditsBalance: { decrement: 1 } },
      });

      if (ownerCharged.count !== 1) {
        await this.recordUnrewardedForInsufficientCredits(
          tx,
          claimId,
          actorUserId,
          repository,
        );
        return { credited: false, status: 'cancelled_insufficient_credits' };
      }

      await tx.user.update({
        where: { id: actorUserId },
        data: { creditsBalance: { increment: 1 } },
      });

      const claim = await tx.taskClaim.findUniqueOrThrow({
        where: { id: claimId },
      });

      const action = await tx.starAction.create({
        data: {
          taskId: claim.taskId,
          repositoryId: repository.id,
          actorUserId,
          githubOwner: repository.githubOwner,
          githubRepo: repository.githubRepo,
          status: StarActionStatus.completed_rewarded,
          githubVerifiedAt: new Date(),
        },
      });

      await tx.creditLedger.createMany({
        data: [
          {
            userId: actorUserId,
            amount: 1,
            reason: CreditReason.star_completed_reward,
            relatedEntityType: 'star_action',
            relatedEntityId: action.id,
          },
          {
            userId: repository.ownerUserId,
            amount: -1,
            reason: CreditReason.repository_star_spend,
            relatedEntityType: 'star_action',
            relatedEntityId: action.id,
          },
        ],
      });

      await tx.taskClaim.update({
        where: { id: claimId },
        data: {
          status: TaskClaimStatus.completed_rewarded,
          completedAt: new Date(),
        },
      });

      return { credited: true, status: 'completed_rewarded' };
    });
  }

  private async checkClaimAvailability(
    claimId: string,
    actorUserId: string,
    repositoryId: string,
    ownerUserId: string,
  ): Promise<string | null> {
    const [actor, owner, repository, limitStatus] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: actorUserId },
        select: { status: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: ownerUserId },
        select: { status: true, creditsBalance: true },
      }),
      this.prisma.repository.findUniqueOrThrow({
        where: { id: repositoryId },
        select: { status: true },
      }),
      this.getDailyLimitStatus(this.prisma, actorUserId, repositoryId),
    ]);

    if (actor.status !== UserStatus.active) {
      await this.markClaimCancelled(
        claimId,
        TaskClaimStatus.cancelled_repository_unavailable,
      );
      return 'account_suspended';
    }

    if (
      owner.status !== UserStatus.active ||
      repository.status !== RepositoryStatus.active
    ) {
      await this.markClaimCancelled(
        claimId,
        TaskClaimStatus.cancelled_repository_unavailable,
      );
      return 'cancelled_repository_unavailable';
    }

    if (owner.creditsBalance < 1) {
      await this.markClaimCancelled(
        claimId,
        TaskClaimStatus.cancelled_insufficient_credits,
      );
      return 'completed_unrewarded_insufficient_credits';
    }

    if (limitStatus) {
      await this.markClaimCancelled(
        claimId,
        TaskClaimStatus.cancelled_daily_limit,
      );
      return limitStatus;
    }

    return null;
  }

  private async getDailyLimitStatus(
    tx: Prisma.TransactionClient | PrismaService,
    actorUserId: string,
    repositoryId: string,
  ): Promise<string | null> {
    const { start, end } = serverLocalDayRange();
    const [actorRewardedToday, repositoryRewardedToday] = await Promise.all([
      tx.starAction.count({
        where: {
          actorUserId,
          status: StarActionStatus.completed_rewarded,
          createdAt: { gte: start, lt: end },
        },
      }),
      tx.starAction.count({
        where: {
          repositoryId,
          status: StarActionStatus.completed_rewarded,
          createdAt: { gte: start, lt: end },
        },
      }),
    ]);

    if (actorRewardedToday >= USER_DAILY_REWARDED_LIMIT) {
      return 'daily_user_limit_reached';
    }

    if (repositoryRewardedToday >= REPOSITORY_DAILY_REWARDED_LIMIT) {
      return 'daily_repository_limit_reached';
    }

    return null;
  }

  private async getTaskBlockStatus(
    userId: string,
  ): Promise<TaskBlockStatus | null> {
    if (!this.config.starTasksEnabled) {
      return 'tasks_disabled';
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true },
    });

    if (user.status === UserStatus.suspended) {
      return 'account_suspended';
    }

    const { start, end } = serverLocalDayRange();
    const rewardedToday = await this.prisma.starAction.count({
      where: {
        actorUserId: userId,
        status: StarActionStatus.completed_rewarded,
        createdAt: { gte: start, lt: end },
      },
    });

    return rewardedToday >= USER_DAILY_REWARDED_LIMIT
      ? 'daily_user_limit_reached'
      : null;
  }

  private async markClaimCancelled(
    claimId: string,
    status: TaskClaimStatus,
  ) {
    await this.prisma.taskClaim.updateMany({
      where: { id: claimId, status: TaskClaimStatus.claimed },
      data: {
        status,
        completedAt: new Date(),
      },
    });
  }

  private async withGithubAuthorizationInvalidation<T>(
    userId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.authService.markGithubAuthorizationInvalid(userId);
      }
      throw error;
    }
  }

  private async recordUnrewardedForInsufficientCredits(
    tx: Prisma.TransactionClient,
    claimId: string,
    actorUserId: string,
    repository: {
      id: string;
      githubOwner: string;
      githubRepo: string;
    },
  ) {
    const claim = await tx.taskClaim.findUniqueOrThrow({
      where: { id: claimId },
    });

    await tx.starAction.upsert({
      where: {
        actorUserId_repositoryId: {
          actorUserId,
          repositoryId: repository.id,
        },
      },
      create: {
        taskId: claim.taskId,
        repositoryId: repository.id,
        actorUserId,
        githubOwner: repository.githubOwner,
        githubRepo: repository.githubRepo,
        status: StarActionStatus.completed_unrewarded_insufficient_credits,
        githubVerifiedAt: new Date(),
      },
      update: {},
    });

    await tx.taskClaim.update({
      where: { id: claimId },
      data: {
        status: TaskClaimStatus.cancelled_insufficient_credits,
        completedAt: new Date(),
      },
    });
  }
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function serverLocalDayRange(now = new Date()) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );

  return { start, end };
}

function serializeCurrentClaim(claim: {
  id: string;
  expiresAt: Date;
  task: { id: string; rewardCredits: number };
  repository: {
    id: string;
    githubOwner: string;
    githubRepo: string;
    description: string | null;
    starsCountSnapshot: number;
  };
}) {
  return {
    status: 'available',
    claimId: claim.id,
    expiresAt: claim.expiresAt,
    rewardCredits: claim.task.rewardCredits,
    repository: {
      id: claim.repository.id,
      owner: claim.repository.githubOwner,
      repo: claim.repository.githubRepo,
      fullName: `${claim.repository.githubOwner}/${claim.repository.githubRepo}`,
      description: claim.repository.description,
      starsCountSnapshot: claim.repository.starsCountSnapshot,
    },
  };
}
