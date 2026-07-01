import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { StarActionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  GithubAuthenticatedUser,
  GithubClient,
  GithubRepository,
  GithubUser,
} from './github.service';
import { MOCK_GITHUB_REPOSITORIES, MOCK_GITHUB_USERS } from './mock-github.data';

const REQUIRED_GITHUB_SCOPES = ['read:user', 'public_repo'];

@Injectable()
export class MockGithubClient implements GithubClient {
  private readonly starredInProcess = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async exchangeOAuthCode(): Promise<string> {
    throw new UnauthorizedException('Mock OAuth code exchange is not supported');
  }

  async getAuthenticatedUser(token: string): Promise<GithubUser> {
    return (await this.getAuthenticatedUserWithScopes(token)).user;
  }

  async getAuthenticatedUserWithScopes(
    token: string,
  ): Promise<GithubAuthenticatedUser> {
    const login = readMockLoginFromToken(token);
    const user = MOCK_GITHUB_USERS.find((candidate) => candidate.login === login);

    if (!user) {
      throw new UnauthorizedException('Unknown mock GitHub user');
    }

    return {
      user: {
        id: BigInt(user.githubUserId),
        login: user.login,
        avatarUrl: user.avatarUrl,
      },
      scopes: REQUIRED_GITHUB_SCOPES,
    };
  }

  async getRepository(
    owner: string,
    repo: string,
  ): Promise<GithubRepository> {
    const repository = MOCK_GITHUB_REPOSITORIES.find(
      (candidate) => candidate.owner === owner && candidate.repo === repo,
    );

    if (!repository) {
      throw new NotFoundException('Mock GitHub repository not found');
    }

    return {
      id: BigInt(repository.githubRepoId),
      owner: repository.owner,
      repo: repository.repo,
      description: repository.description,
      starsCount: repository.starsCount,
      isPrivate: false,
    };
  }

  async listPublicRepositories(githubLogin: string): Promise<GithubRepository[]> {
    return MOCK_GITHUB_REPOSITORIES.filter(
      (repository) => repository.owner === githubLogin,
    ).map((repository) => ({
      id: BigInt(repository.githubRepoId),
      owner: repository.owner,
      repo: repository.repo,
      description: repository.description,
      starsCount: repository.starsCount,
      isPrivate: false,
    }));
  }

  async isStarred(owner: string, repo: string, token: string): Promise<boolean> {
    const actor = await this.getAuthenticatedUser(token);
    const user = await this.prisma.user.findUnique({
      where: { githubUserId: actor.id },
      select: { id: true },
    });

    if (!user) {
      return false;
    }

    const repository = await this.prisma.repository.findFirst({
      where: {
        githubOwner: owner,
        githubRepo: repo,
      },
      select: { id: true },
    });

    if (!repository) {
      return false;
    }

    const action = await this.prisma.starAction.findUnique({
      where: {
        actorUserId_repositoryId: {
          actorUserId: user.id,
          repositoryId: repository.id,
        },
      },
    });

    return (
      this.starredInProcess.has(starKey(actor.login, owner, repo)) ||
      action?.status === StarActionStatus.completed_rewarded ||
      action?.status === StarActionStatus.already_starred_no_reward ||
      action?.status ===
        StarActionStatus.completed_unrewarded_insufficient_credits
    );
  }

  async starRepository(
    owner: string,
    repo: string,
    token: string,
  ): Promise<void> {
    const actor = await this.getAuthenticatedUser(token);
    this.starredInProcess.add(starKey(actor.login, owner, repo));
  }
}

function readMockLoginFromToken(token: string): string {
  if (!token.startsWith('mock:')) {
    throw new UnauthorizedException('Invalid mock GitHub token');
  }

  return token.slice('mock:'.length);
}

function starKey(actorLogin: string, owner: string, repo: string): string {
  return `${actorLogin}:${owner}/${repo}`;
}
