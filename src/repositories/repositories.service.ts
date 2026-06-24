import { BadRequestException, Injectable } from '@nestjs/common';
import { StarActionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GithubService } from '../github/github.service';
import { parseGithubRepositoryUrl } from './repository-url';

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

    const repository = await this.prisma.repository.upsert({
      where: {
        githubOwner_githubRepo: {
          githubOwner: githubRepo.owner,
          githubRepo: githubRepo.repo,
        },
      },
      create: {
        ownerUserId: userId,
        githubOwner: githubRepo.owner,
        githubRepo: githubRepo.repo,
        githubRepoId: githubRepo.id,
        description: githubRepo.description,
        starsCountSnapshot: githubRepo.starsCount,
        starTask: { create: {} },
      },
      update: {
        description: githubRepo.description,
        starsCountSnapshot: githubRepo.starsCount,
        status: 'active',
      },
      include: repositorySummaryInclude(),
    });

    if (repository.ownerUserId !== userId) {
      throw new BadRequestException('Repository has already been submitted');
    }

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
    const [githubRepositories, submittedRepositories] = await Promise.all([
      this.github.listPublicRepositories(githubLogin, token),
      this.prisma.repository.findMany({
        where: { ownerUserId: userId },
        include: repositorySummaryInclude(),
      }),
    ]);

    const submittedByGithubId = new Map(
      submittedRepositories.map((repository) => [
        repository.githubRepoId.toString(),
        serializeRepository(repository),
      ]),
    );

    return githubRepositories.map((repository) => ({
      githubRepoId: repository.id.toString(),
      githubOwner: repository.owner,
      githubRepo: repository.repo,
      description: repository.description ?? null,
      starsCountSnapshot: repository.starsCount,
      submittedRepository: submittedByGithubId.get(repository.id.toString()) ?? null,
    }));
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
