import { BadRequestException, Injectable } from '@nestjs/common';
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
    const token = await this.authService.getActivePlainToken(userId);
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
      include: { starTask: true },
    });

    if (repository.ownerUserId !== userId) {
      throw new BadRequestException('Repository has already been submitted');
    }

    return serializeRepository(repository);
  }

  async listMine(userId: string) {
    const repositories = await this.prisma.repository.findMany({
      where: { ownerUserId: userId },
      include: { starTask: true },
      orderBy: { createdAt: 'desc' },
    });

    return repositories.map(serializeRepository);
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
  };
}
