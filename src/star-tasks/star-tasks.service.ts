import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreditReason,
  Prisma,
  StarActionStatus,
  TaskClaimStatus,
} from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { GithubService } from '../github/github.service';

const CLAIM_TTL_MINUTES = 10;

interface CandidateTask {
  id: string;
  repository_id: string;
}

@Injectable()
export class StarTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly github: GithubService,
  ) {}

  async executeNext(userId: string) {
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
    return this.performClaim(userId, claimId);
  }

  async skipClaim(userId: string, claimId: string) {
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

    const token = await this.authService.getActivePlainToken(userId);
    const repository = claim.repository;

    if (repository.ownerUserId === userId) {
      throw new ForbiddenException('Cannot star your own repository');
    }

    const alreadyStarred = await this.github.isStarred(
      repository.githubOwner,
      repository.githubRepo,
      token,
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

    await this.github.starRepository(
      repository.githubOwner,
      repository.githubRepo,
      token,
    );

    const verified = await this.github.isStarred(
      repository.githubOwner,
      repository.githubRepo,
      token,
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
    if (!settled) {
      return {
        status: 'completed_unrewarded_insufficient_credits',
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
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<CandidateTask[]>`
        select st.id, st.repository_id
        from star_tasks st
        join repositories r on r.id = st.repository_id
        join users owner on owner.id = r.owner_user_id
        where st.status = 'active'
          and r.status = 'active'
          and r.owner_user_id <> ${userId}
          and owner.credits_balance > 0
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
        order by st.created_at asc
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
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const ownerCharged = await tx.user.updateMany({
        where: {
          id: repository.ownerUserId,
          creditsBalance: { gte: 1 },
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
        return false;
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

      return true;
    });
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
