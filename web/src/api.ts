const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, '');

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface MockUser {
  githubUserId: string;
  githubLogin: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface MockUsersResponse {
  mockGithubEnabled: boolean;
  users: MockUser[];
}

export interface User {
  id: string;
  githubUserId: string;
  githubLogin: string;
  avatarUrl: string | null;
  status: string;
  creditsBalance: number;
  githubAuthorizationStatus?: string | null;
  isAdmin?: boolean;
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
  status:
    | 'no_task_available'
    | 'tasks_disabled'
    | 'account_suspended'
    | 'daily_user_limit_reached';
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
  starBuddyStarsCount: number;
  recentStars: RepositoryStar[];
}

export interface PromotionSwitchStatus {
  canSwitch: boolean;
  switchUsedToday: boolean;
  lastSwitchedAt: string | null;
  serverNow: string;
  nextSwitchResetAt: string;
}

export interface RepositoryStar {
  id: string;
  starredAt: string;
  actor: {
    id: string;
    githubLogin: string;
    avatarUrl: string | null;
  };
}

export interface GithubRepository {
  githubRepoId: string;
  githubOwner: string;
  githubRepo: string;
  description: string | null;
  starsCountSnapshot: number;
  submittedRepository: Repository | null;
}

export interface GithubRepositoriesResponse {
  repositories: GithubRepository[];
  promotionSwitch: PromotionSwitchStatus;
}

export type TaskResult = {
  status: string;
  repository?: string;
  claimId?: string;
  actorCreditDelta?: number;
  ownerCreditDelta?: number;
};

export interface AdminSystemStatus {
  starTasksEnabled: boolean;
  repositoryPromotionEnabled: boolean;
  adminGithubLogins: string[];
  cleanupIntervalMs: number;
  githubRequestTimeoutMs: number;
  serverNow: string;
}

export interface RepositoryReport {
  id: string;
  reason: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  repository: {
    id: string;
    githubOwner: string;
    githubRepo: string;
    status: string;
  };
  reporter: {
    id: string;
    githubLogin: string;
    avatarUrl: string | null;
  };
}

export interface CleanupResult {
  oauthLoginCodes: number;
  rateLimitEvents: number;
  taskClaims: number;
  repositoryReports: number;
  cleanedAt: string;
}

export class ApiClient {
  constructor(private readonly getAccessToken: () => string | null) {}

  createSession(code: string) {
    return this.request<AuthResponse>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  listMockUsers() {
    return this.request<MockUsersResponse>('/auth/mock-users');
  }

  createMockSession(login: string) {
    return this.request<AuthResponse>('/auth/mock-session', {
      method: 'POST',
      body: JSON.stringify({ login }),
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

  createRepositoryFromGithub(githubRepoId: string) {
    return this.request<Repository>(`/repositories/github/${githubRepoId}`, {
      method: 'POST',
    });
  }

  listRepositories() {
    return this.request<Repository[]>('/repositories/mine');
  }

  listGithubRepositories() {
    return this.request<GithubRepositoriesResponse>('/repositories/github/mine');
  }

  activateRepository(repositoryId: string) {
    return this.request<Repository>(`/repositories/${repositoryId}/activate`, {
      method: 'POST',
    });
  }

  pauseRepository(repositoryId: string) {
    return this.request<Repository>(`/repositories/${repositoryId}/pause`, {
      method: 'POST',
    });
  }

  resumeRepository(repositoryId: string) {
    return this.request<Repository>(`/repositories/${repositoryId}/resume`, {
      method: 'POST',
    });
  }

  reportRepository(repositoryId: string, reason?: string) {
    return this.request<{ id: string; status: string; repositoryId: string }>(
      `/repositories/${repositoryId}/report`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
    );
  }

  getAdminSystem() {
    return this.request<AdminSystemStatus>('/admin/system');
  }

  listAdminReports() {
    return this.request<RepositoryReport[]>('/admin/reports');
  }

  adminArchiveRepository(repositoryId: string) {
    return this.request<Repository>(`/admin/repositories/${repositoryId}/archive`, {
      method: 'POST',
    });
  }

  adminRejectRepository(repositoryId: string) {
    return this.request<Repository>(`/admin/repositories/${repositoryId}/reject`, {
      method: 'POST',
    });
  }

  adminRestoreRepository(repositoryId: string) {
    return this.request<Repository>(`/admin/repositories/${repositoryId}/restore`, {
      method: 'POST',
    });
  }

  adminSuspendUser(userId: string) {
    return this.request<User>(`/admin/users/${userId}/suspend`, {
      method: 'POST',
    });
  }

  adminUnsuspendUser(userId: string) {
    return this.request<User>(`/admin/users/${userId}/unsuspend`, {
      method: 'POST',
    });
  }

  adminCleanup() {
    return this.request<CleanupResult>('/admin/cleanup', {
      method: 'POST',
    });
  }

  getCreditsBalance() {
    return this.request<{
      creditsBalance: number;
      reservedCredits: number;
      availableCredits: number;
    }>('/credits/balance');
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
