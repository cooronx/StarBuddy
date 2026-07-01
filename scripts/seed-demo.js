"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const mock_github_data_1 = require("../src/github/mock-github.data");
const prisma = new client_1.PrismaClient();
const MOCK_LOGINS = mock_github_data_1.MOCK_GITHUB_USERS.map((user) => user.login);
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
        const usersByLogin = new Map();
        const repositoriesByFullName = new Map();
        for (const mockUser of mock_github_data_1.MOCK_GITHUB_USERS) {
            const user = await tx.user.create({
                data: {
                    githubUserId: BigInt(mockUser.githubUserId),
                    githubLogin: mockUser.login,
                    avatarUrl: mockUser.avatarUrl,
                    creditsBalance: MOCK_CREDITS,
                    lastPromotionSwitchAt: mockUser.login === 'mock-diana' ? new Date() : null,
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
                            reason: client_1.CreditReason.signup_bonus,
                        },
                    },
                },
            });
            usersByLogin.set(mockUser.login, user);
        }
        for (const mockRepository of mock_github_data_1.MOCK_GITHUB_REPOSITORIES.filter((repository) => repository.submitted)) {
            const owner = usersByLogin.get(mockRepository.owner);
            if (!owner) {
                throw new Error(`Missing mock owner: ${mockRepository.owner}`);
            }
            const status = repositoryStatusForSeed(mockRepository.owner, mockRepository.repo);
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
            repositoriesByFullName.set(`${mockRepository.owner}/${mockRepository.repo}`, repository);
        }
        await createRewardedStar(tx, usersByLogin, repositoriesByFullName, 'mock-bob', 'mock-alice/demo-api', 7);
        await createRewardedStar(tx, usersByLogin, repositoriesByFullName, 'mock-charlie', 'mock-alice/demo-api', 6);
        await createRewardedStar(tx, usersByLogin, repositoriesByFullName, 'mock-diana', 'mock-bob/demo-ui', 5);
        await createNoRewardStar(tx, usersByLogin, repositoriesByFullName, 'mock-alice', 'mock-charlie/demo-cli', 4);
        await createReport(tx, usersByLogin, repositoriesByFullName, 'mock-alice', 'mock-bob/demo-theme', 'Looks like a rejected demo repository.');
        await createReport(tx, usersByLogin, repositoriesByFullName, 'mock-charlie', 'mock-admin/demo-ops', 'Mock report for admin panel testing.');
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
        throw new Error('Refusing to seed demo data unless DATABASE_URL points to localhost or 127.0.0.1');
    }
}
function repositoryStatusForSeed(owner, repo) {
    if (owner === 'mock-alice' && repo === 'demo-docs') {
        return client_1.RepositoryStatus.paused;
    }
    if (owner === 'mock-bob' && repo === 'demo-theme') {
        return client_1.RepositoryStatus.rejected;
    }
    return repo.endsWith('api') ||
        repo.endsWith('ui') ||
        repo.endsWith('cli') ||
        repo.endsWith('mobile') ||
        repo.endsWith('admin')
        ? client_1.RepositoryStatus.active
        : client_1.RepositoryStatus.inactive;
}
async function createRewardedStar(tx, usersByLogin, repositoriesByFullName, actorLogin, fullName, daysAgo) {
    const actor = requireMapValue(usersByLogin, actorLogin);
    const repository = requireMapValue(repositoriesByFullName, fullName);
    const createdAt = daysBefore(daysAgo);
    const claim = await tx.taskClaim.create({
        data: {
            taskId: await taskIdForRepository(tx, repository.id),
            repositoryId: repository.id,
            userId: actor.id,
            status: client_1.TaskClaimStatus.completed_rewarded,
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
            status: client_1.StarActionStatus.completed_rewarded,
            githubVerifiedAt: createdAt,
            createdAt,
        },
    });
    await tx.creditLedger.create({
        data: {
            userId: actor.id,
            amount: 1,
            reason: client_1.CreditReason.star_completed_reward,
            relatedEntityType: 'star_action',
            relatedEntityId: action.id,
            createdAt,
        },
    });
}
async function createNoRewardStar(tx, usersByLogin, repositoriesByFullName, actorLogin, fullName, daysAgo) {
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
            status: client_1.TaskClaimStatus.completed_no_reward,
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
            status: client_1.StarActionStatus.already_starred_no_reward,
            githubVerifiedAt: createdAt,
            createdAt,
        },
    });
}
async function createReport(tx, usersByLogin, repositoriesByFullName, reporterLogin, fullName, reason) {
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
async function taskIdForRepository(tx, repositoryId) {
    const task = await tx.starTask.findUniqueOrThrow({
        where: { repositoryId },
        select: { id: true },
    });
    return task.id;
}
function requireMapValue(map, key) {
    const value = map.get(key);
    if (!value) {
        throw new Error(`Missing seed value: ${key}`);
    }
    return value;
}
function daysBefore(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
function mockValue(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('base64').slice(0, 24);
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-demo.js.map