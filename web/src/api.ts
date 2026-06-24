export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface User {
  id: string;
  githubUserId: string;
  githubLogin: string;
  avatarUrl: string | null;
  creditsBalance: number;
  githubAuthorizationStatus?: string | null;
}

export interface CurrentTask {
  status: 'available';
  claimId: string;
  expiresAt: string;
  rewardCredits: number;
  repository: {
    id: string;
    owner: string;
    repo: string;
    fullName: string;
    description: string | null;
    starsCountSnapshot: number;
  };
}

export interface EmptyTask {
  status: 'no_task_available';
}

export interface CreditLedgerEntry {
  id: string;
  amount: number;
  reason: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface Repository {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubRepoId: string;
  description: string | null;
  starsCountSnapshot: number;
  status: string;
  starTask: {
    id: string;
    status: string;
  } | null;
}

export interface GithubRepository {
  githubRepoId: string;
  githubOwner: string;
  githubRepo: string;
  description: string | null;
  starsCountSnapshot: number;
  submittedRepository: Repository | null;
}

export type TaskResult = {
  status: string;
  repository?: string;
  claimId?: string;
  actorCreditDelta?: number;
  ownerCreditDelta?: number;
};

export class ApiClient {
  constructor(private readonly getAccessToken: () => string | null) {}

  createSession(code: string) {
    return this.request<AuthResponse>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  getMe() {
    return this.request<User>('/auth/me');
  }

  getCurrentTask() {
    return this.request<CurrentTask | EmptyTask>('/star-tasks/current');
  }

  starClaim(claimId: string) {
    return this.request<TaskResult>(`/star-tasks/${claimId}/star`, {
      method: 'POST',
    });
  }

  skipClaim(claimId: string) {
    return this.request<TaskResult>(`/star-tasks/${claimId}/skip`, {
      method: 'POST',
    });
  }

  createRepository(url: string) {
    return this.request<Repository>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  listRepositories() {
    return this.request<Repository[]>('/repositories/mine');
  }

  listGithubRepositories() {
    return this.request<GithubRepository[]>('/repositories/github/mine');
  }

  getCreditsBalance() {
    return this.request<{ creditsBalance: number }>('/credits/balance');
  }

  getLedger() {
    return this.request<CreditLedgerEntry[]>('/credits/ledger');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return (await response.json()) as T;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
    return JSON.stringify(body);
  } catch {
    return response.statusText;
  }
}
