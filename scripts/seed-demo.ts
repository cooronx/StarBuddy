import {
  CreditReason,
  Prisma,
  PrismaClient,
  RepositoryStatus,
  StarActionStatus,
  TaskClaimStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import {
  MOCK_GITHUB_REPOSITORIES,
  MOCK_GITHUB_USERS,
} from '../src/github/mock-github.data';

const prisma = new PrismaClient();
const MOCK_LOGINS = MOCK_GITHUB_USERS.map((user) => user.login);
const MOCK_CREDITS = 10;

async function main() {
  assertSafeToSeed();

  await prisma.$transaction(async (tx) => {
    const existingUsers = await tx.user.findMany({
      where: { githubLogin: { in: MOCK_LOGINS } },
      select: { id: true },
    });

    await tx.user.deleteMany({
      where: { id: { in: existingUsers.map((user) => user.id) } },
    });

    const usersByLogin = new Map<string, { id: string }>();
    const repositoriesByFullName = new Map<string, { id: string }>();

    for (const mockUser of MOCK_GITHUB_USERS) {
      const user = await tx.user.create({
        data: {
          githubUserId: BigInt(mockUser.githubUserId),
          githubLogin: mockUser.login,
          avatarUrl: mockUser.avatarUrl,
          creditsBalance: MOCK_CREDITS,
          lastPromotionSwitchAt:
            mockUser.login === 'mock-diana' ? new Date() : null,
          githubAuthorization: {
            create: {
              encryptedAccessToken: `mock:${mockUser.login}`,
              accessTokenIv: mockValue(`iv:${mockUser.login}`),
              accessTokenAuthTag: mockValue(`tag:${mockUser.login}`),
              scopes: ['read:user', 'public_repo'],
              status: 'active',
              lastVerifiedAt: new Date(),
            },
          },
          creditLedger: {
            create: {
              amount: MOCK_CREDITS,
              reason: CreditReason.signup_bonus,
            },
          },
        },
      });

      usersByLogin.set(mockUser.login, user);
    }

    for (const mockRepository of MOCK_GITHUB_REPOSITORIES.filter(
      (repository) => repository.submitted,
    )) {
      const owner = usersByLogin.get(mockRepository.owner);
      if (!owner) {
        throw new Error(`Missing mock owner: ${mockRepository.owner}`);
      }

      const status = repositoryStatusForSeed(
        mockRepository.owner,
        mockRepository.repo,
      );
      const repository = await tx.repository.create({
        data: {
          ownerUserId: owner.id,
          githubOwner: mockRepository.owner,
          githubRepo: mockRepository.repo,
          githubRepoId: BigInt(mockRepository.githubRepoId),
          description: mockRepository.description,
          starsCountSnapshot: mockRepository.starsCount,
          status,
          starTask: { create: {} },
        },
      });

      repositoriesByFullName.set(
        `${mockRepository.owner}/${mockRepository.repo}`,
        repository,
      );
    }

    await createRewardedStar(
      tx,
      usersByLogin,
      repositoriesByFullName,
      'mock-bob',
      'mock-alice/demo-api',
      7,
    );
    await createRewardedStar(
      tx,
      usersByLogin,
      repositoriesByFullName,
      'mock-charlie',
      'mock-alice/demo-api',
      6,
    );
    await createRewardedStar(
      tx,
      usersByLogin,
      repositoriesByFullName,
      'mock-diana',
      'mock-bob/demo-ui',
      5,
    );
    await createNoRewardStar(
      tx,
      usersByLogin,
      repositoriesByFullName,
      'mock-alice',
      'mock-charlie/demo-cli',
      4,
    );

    await createReport(
      tx,
      usersByLogin,
      repositoriesByFullName,
      'mock-alice',
      'mock-bob/demo-theme',
      'Looks like a rejected demo repository.',
    );
    await createReport(
      tx,
      usersByLogin,
      repositoriesByFullName,
      'mock-charlie',
      'mock-admin/demo-ops',
      'Mock report for admin panel testing.',
    );
  });

  console.log(`Seeded demo data for ${MOCK_LOGINS.join(', ')}`);
}

function assertSafeToSeed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) {
    throw new Error(
      'Refusing to seed demo data unless DATABASE_URL points to localhost or 127.0.0.1',
    );
  }
}

function repositoryStatusForSeed(owner: string, repo: string): RepositoryStatus {
  if (owner === 'mock-alice' && repo === 'demo-api') {
    return RepositoryStatus.inactive;
  }

  if (owner === 'mock-alice' && repo === 'demo-docs') {
    return RepositoryStatus.paused;
  }

  if (owner === 'mock-bob' && repo === 'demo-theme') {
    return RepositoryStatus.rejected;
  }

  return repo.endsWith('api') ||
    repo.endsWith('ui') ||
    repo.endsWith('cli') ||
    repo.endsWith('mobile') ||
    repo.endsWith('admin')
    ? RepositoryStatus.active
    : RepositoryStatus.inactive;
}

async function createRewardedStar(
  tx: PrismaTransaction,
  usersByLogin: Map<string, { id: string }>,
  repositoriesByFullName: Map<string, { id: string }>,
  actorLogin: string,
  fullName: string,
  daysAgo: number,
) {
  const actor = requireMapValue(usersByLogin, actorLogin);
  const repository = requireMapValue(repositoriesByFullName, fullName);
  const createdAt = daysBefore(daysAgo);
  const ownerId = await ownerUserIdForRepository(tx, repository.id);

  const claim = await tx.taskClaim.create({
    data: {
      taskId: await taskIdForRepository(tx, repository.id),
      repositoryId: repository.id,
      userId: actor.id,
      status: TaskClaimStatus.completed_rewarded,
      claimedAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
      completedAt: createdAt,
    },
  });

  const [owner, repo] = fullName.split('/');
  const action = await tx.starAction.create({
    data: {
      taskId: claim.taskId,
      repositoryId: repository.id,
      actorUserId: actor.id,
      githubOwner: owner,
      githubRepo: repo,
      status: StarActionStatus.completed_rewarded,
      githubVerifiedAt: createdAt,
      createdAt,
    },
  });

  await tx.creditLedger.create({
    data: {
      userId: ownerId,
      amount: -1,
      reason: CreditReason.repository_star_spend,
      relatedEntityType: 'star_action',
      relatedEntityId: action.id,
      createdAt,
    },
  });

  await tx.creditLedger.create({
    data: {
      userId: actor.id,
      amount: 1,
      reason: CreditReason.star_completed_reward,
      relatedEntityType: 'star_action',
      relatedEntityId: action.id,
      createdAt,
    },
  });

  await tx.user.update({
    where: { id: ownerId },
    data: { creditsBalance: { decrement: 1 } },
  });

  await tx.user.update({
    where: { id: actor.id },
    data: { creditsBalance: { increment: 1 } },
  });
}

async function createNoRewardStar(
  tx: PrismaTransaction,
  usersByLogin: Map<string, { id: string }>,
  repositoriesByFullName: Map<string, { id: string }>,
  actorLogin: string,
  fullName: string,
  daysAgo: number,
) {
  const actor = requireMapValue(usersByLogin, actorLogin);
  const repository = requireMapValue(repositoriesByFullName, fullName);
  const createdAt = daysBefore(daysAgo);
  const [owner, repo] = fullName.split('/');
  const taskId = await taskIdForRepository(tx, repository.id);

  await tx.taskClaim.create({
    data: {
      taskId,
      repositoryId: repository.id,
      userId: actor.id,
      status: TaskClaimStatus.completed_no_reward,
      claimedAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
      completedAt: createdAt,
    },
  });

  await tx.starAction.create({
    data: {
      taskId,
      repositoryId: repository.id,
      actorUserId: actor.id,
      githubOwner: owner,
      githubRepo: repo,
      status: StarActionStatus.already_starred_no_reward,
      githubVerifiedAt: createdAt,
      createdAt,
    },
  });
}

async function createReport(
  tx: PrismaTransaction,
  usersByLogin: Map<string, { id: string }>,
  repositoriesByFullName: Map<string, { id: string }>,
  reporterLogin: string,
  fullName: string,
  reason: string,
) {
  const reporter = requireMapValue(usersByLogin, reporterLogin);
  const repository = requireMapValue(repositoriesByFullName, fullName);

  await tx.repositoryReport.create({
    data: {
      repositoryId: repository.id,
      reporterUserId: reporter.id,
      reason,
    },
  });
}

async function taskIdForRepository(tx: PrismaTransaction, repositoryId: string) {
  const task = await tx.starTask.findUniqueOrThrow({
    where: { repositoryId },
    select: { id: true },
  });

  return task.id;
}

async function ownerUserIdForRepository(
  tx: PrismaTransaction,
  repositoryId: string,
) {
  const repository = await tx.repository.findUniqueOrThrow({
    where: { id: repositoryId },
    select: { ownerUserId: true },
  });

  return repository.ownerUserId;
}

function requireMapValue<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Missing seed value: ${key}`);
  }
  return value;
}

function daysBefore(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function mockValue(value: string) {
  return createHash('sha256').update(value).digest('base64').slice(0, 24);
}

type PrismaTransaction = Prisma.TransactionClient;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
