import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

interface GithubUserResponse {
  id: number;
  login: string;
  avatar_url?: string;
}

interface GithubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description?: string | null;
  stargazers_count: number;
}

interface GithubOAuthTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GithubUser {
  id: bigint;
  login: string;
  avatarUrl?: string;
}

export interface GithubRepository {
  id: bigint;
  owner: string;
  repo: string;
  description?: string;
  starsCount: number;
  isPrivate: boolean;
}

export interface GithubAuthenticatedUser {
  user: GithubUser;
  scopes: string[];
}

@Injectable()
export class GithubService {
  async exchangeOAuthCode(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'StarBuddy',
      },
      body: JSON.stringify({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    });

    if (!response.ok) {
      await this.throwGithubError(response);
    }

    const body = (await response.json()) as GithubOAuthTokenResponse;
    if (!body.access_token) {
      throw new UnauthorizedException(
        body.error_description ?? body.error ?? 'GitHub OAuth failed',
      );
    }

    return body.access_token;
  }

  async getAuthenticatedUser(token: string): Promise<GithubUser> {
    return (await this.getAuthenticatedUserWithScopes(token)).user;
  }

  async getAuthenticatedUserWithScopes(
    token: string,
  ): Promise<GithubAuthenticatedUser> {
    const response = await this.rawRequest('/user', token, 'GET');

    if (!response.ok) {
      await this.throwGithubError(response);
    }

    const user = (await response.json()) as GithubUserResponse;

    return {
      user: {
        id: BigInt(user.id),
        login: user.login,
        avatarUrl: user.avatar_url,
      },
      scopes: parseOAuthScopes(response.headers.get('x-oauth-scopes')),
    };
  }

  async getRepository(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<GithubRepository> {
    const response = await this.request<GithubRepositoryResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      token,
    );

    return {
      id: BigInt(response.id),
      owner: response.owner.login,
      repo: response.name,
      description: response.description ?? undefined,
      starsCount: response.stargazers_count,
      isPrivate: response.private,
    };
  }

  async listPublicRepositories(
    githubLogin: string,
    token?: string,
  ): Promise<GithubRepository[]> {
    const repositories: GithubRepository[] = [];
    let page = 1;

    while (page <= 10) {
      const response = await this.request<GithubRepositoryResponse[]>(
        `/users/${encodeURIComponent(githubLogin)}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
        token,
      );

      repositories.push(
        ...response.map((repository) => ({
          id: BigInt(repository.id),
          owner: repository.owner.login,
          repo: repository.name,
          description: repository.description ?? undefined,
          starsCount: repository.stargazers_count,
          isPrivate: repository.private,
        })),
      );

      if (response.length < 100) {
        break;
      }

      page += 1;
    }

    return repositories.filter((repository) => !repository.isPrivate);
  }

  async isStarred(owner: string, repo: string, token: string): Promise<boolean> {
    const response = await this.rawRequest(
      `/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      token,
      'GET',
    );

    if (response.status === 204) {
      return true;
    }
    if (response.status === 404) {
      return false;
    }
    throw await this.throwGithubError(response);
  }

  async starRepository(
    owner: string,
    repo: string,
    token: string,
  ): Promise<void> {
    const response = await this.rawRequest(
      `/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      token,
      'PUT',
    );

    if (response.status === 204) {
      return;
    }

    await this.throwGithubError(response);
  }

  private async request<T>(path: string, token?: string): Promise<T> {
    const response = await this.rawRequest(path, token, 'GET');

    if (!response.ok) {
      await this.throwGithubError(response);
    }

    return (await response.json()) as T;
  }

  private async rawRequest(
    path: string,
    token: string | undefined,
    method: 'GET' | 'PUT',
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'StarBuddy',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (method === 'PUT') {
      headers['Content-Length'] = '0';
    }

    return fetch(`https://api.github.com${path}`, { method, headers });
  }

  private async throwGithubError(response: Response): Promise<never> {
    if (response.status === 401) {
      throw new UnauthorizedException('GitHub authorization is invalid');
    }

    const detail = await safeReadBody(response);
    throw new BadGatewayException({
      message: 'GitHub API request failed',
      status: response.status,
      detail,
    });
  }
}

function parseOAuthScopes(header: string | null): string[] {
  if (!header) {
    return [];
  }

  return header
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function safeReadBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}
