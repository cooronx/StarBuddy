import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Archive,
  Ban,
  Flag,
  Github,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Star,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import {
  AdminSystemStatus,
  API_BASE_URL,
  ApiClient,
  CreditLedgerEntry,
  CurrentTask,
  EmptyTask,
  GithubRepository,
  MockUser,
  PromotionSwitchStatus,
  RepositoryReport,
  TaskResult,
  User,
} from './api';
import {
  formatLedgerReason,
  formatStatus,
  getInitialLanguage,
  Language,
  LANGUAGE_STORAGE_KEY,
  translate,
} from './i18n';

const ACCESS_TOKEN_KEY = 'starbuddy_access_token';

export function App() {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const [user, setUser] = useState<User | null>(null);
  const [currentTask, setCurrentTask] = useState<CurrentTask | EmptyTask | null>(
    null,
  );
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [promotionSwitch, setPromotionSwitch] =
    useState<PromotionSwitchStatus | null>(null);
  const [adminSystem, setAdminSystem] = useState<AdminSystemStatus | null>(null);
  const [adminReports, setAdminReports] = useState<RepositoryReport[]>([]);
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => new ApiClient(() => accessToken), [accessToken]);
  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
      translate(language, key, values),
    [language],
  );

  const refresh = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [me, task, history, mine] = await Promise.all([
        api.getMe(),
        api.getCurrentTask(),
        api.getLedger(),
        api.listGithubRepositories(),
      ]);

      setUser(me);
      setCurrentTask(task);
      setLedger(history);
      setRepositories(mine.repositories);
      setPromotionSwitch(mine.promotionSwitch);

      if (me.isAdmin) {
        const [system, reports] = await Promise.all([
          api.getAdminSystem(),
          api.listAdminReports(),
        ]);
        setAdminSystem(system);
        setAdminReports(reports);
      } else {
        setAdminSystem(null);
        setAdminReports([]);
      }
    } catch (refreshError) {
      setError(
        errorMessage(refreshError, (key) => translate(getInitialLanguage(), key)),
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (accessToken) {
      setMockUsers([]);
      return;
    }

    api
      .listMockUsers()
      .then((response) => {
        setMockUsers(response.mockGithubEnabled ? response.users : []);
      })
      .catch(() => {
        setMockUsers([]);
      });
  }, [accessToken, api]);

  useEffect(() => {
    if (window.location.pathname !== '/auth/callback') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get('error');
    const code = params.get('code');
    window.history.replaceState({}, '', '/');

    if (callbackError) {
      clearSessionState();
      setLoading(false);
      setError(oauthErrorMessage(callbackError, t));
      return;
    }

    if (!code) {
      clearSessionState();
      setLoading(false);
      setError(t('oauthFailed'));
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    api
      .createSession(code)
      .then((response) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
        setAccessToken(response.accessToken);
        setUser(response.user);
        setMessage(t('loginComplete'));
      })
      .catch((sessionError) => {
        clearSessionState();
        setError(errorMessage(sessionError, t));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [api, t]);

  function handleLogin() {
    setLoading(true);
    setError('');
    setMessage('');
    window.location.href = `${API_BASE_URL}/auth/github`;
  }

  async function handleMockLogin(login: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.createMockSession(login);
      localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
      setAccessToken(response.accessToken);
      setUser(response.user);
      setMessage(t('loginComplete'));
    } catch (mockError) {
      setError(errorMessage(mockError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleRepositorySubmit(githubRepoId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const repository = await api.createRepositoryFromGithub(githubRepoId);
      setMessage(
        t('projectAdded', {
          repository: `${repository.githubOwner}/${repository.githubRepo}`,
        }),
      );
      await refresh();
    } catch (repositoryError) {
      setError(errorMessage(repositoryError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleStar(claimId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.starClaim(claimId);
      setMessage(resultMessage(language, result));
      await refresh();
    } catch (starError) {
      setError(errorMessage(starError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip(claimId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.skipClaim(claimId);
      setMessage(t('skippedLoading'));
      const task = await api.getCurrentTask();
      setCurrentTask(task);
    } catch (skipError) {
      setError(errorMessage(skipError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateRepository(repositoryId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const repository = await api.activateRepository(repositoryId);
      setMessage(
        t('promotionActivated', {
          repository: `${repository.githubOwner}/${repository.githubRepo}`,
        }),
      );
      await refresh();
    } catch (activateError) {
      setError(errorMessage(activateError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handlePauseRepository(repositoryId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const repository = await api.pauseRepository(repositoryId);
      setMessage(
        t('promotionPaused', {
          repository: `${repository.githubOwner}/${repository.githubRepo}`,
        }),
      );
      await refresh();
    } catch (pauseError) {
      setError(errorMessage(pauseError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleResumeRepository(repositoryId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const repository = await api.resumeRepository(repositoryId);
      setMessage(
        t('promotionResumed', {
          repository: `${repository.githubOwner}/${repository.githubRepo}`,
        }),
      );
      await refresh();
    } catch (resumeError) {
      setError(errorMessage(resumeError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleReportRepository(repositoryId: string) {
    const reason = window.prompt(t('reportProject'));
    if (reason === null) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.reportRepository(repositoryId, reason);
      setMessage(t('repositoryReported'));
      await refresh();
    } catch (reportError) {
      setError(errorMessage(reportError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminRepositoryAction(
    repositoryId: string,
    action: 'archive' | 'reject' | 'restore',
  ) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (action === 'archive') {
        await api.adminArchiveRepository(repositoryId);
      } else if (action === 'reject') {
        await api.adminRejectRepository(repositoryId);
      } else {
        await api.adminRestoreRepository(repositoryId);
      }
      await refresh();
    } catch (adminError) {
      setError(errorMessage(adminError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleSuspendUser(userId: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await api.adminSuspendUser(userId);
      await refresh();
    } catch (adminError) {
      setError(errorMessage(adminError, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminCleanup() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.adminCleanup();
      setMessage(
        t('adminCleanupComplete', {
          oauthLoginCodes: result.oauthLoginCodes,
          rateLimitEvents: result.rateLimitEvents,
          taskClaims: result.taskClaims,
          repositoryReports: result.repositoryReports,
        }),
      );
      await refresh();
    } catch (adminError) {
      setError(errorMessage(adminError, t));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSessionState();
    setMessage('');
    setError('');
  }

  function clearSessionState() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
    setCurrentTask(null);
    setLedger([]);
    setRepositories([]);
    setPromotionSwitch(null);
    setAdminSystem(null);
    setAdminReports([]);
  }

  function handleLanguageChange(nextLanguage: Language) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguage(nextLanguage);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Star size={20} />
          </div>
          <div>
            <h1>StarBuddy</h1>
            <p>{t('tagline')}</p>
          </div>
        </div>

        {user ? (
          <div className="profile">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
            <div>
              <strong>{user.githubLogin}</strong>
              <span>
                {user.creditsBalance} {t('credits').toLowerCase()}
              </span>
            </div>
            <LanguageSwitcher
              language={language}
              onChange={handleLanguageChange}
              t={t}
            />
            <button className="icon-button" onClick={refresh} title={t('refresh')}>
              {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
            <button className="ghost-button" onClick={handleLogout}>
              {t('signOut')}
            </button>
          </div>
        ) : (
          <div className="topbar-actions">
            <LanguageSwitcher
              language={language}
              onChange={handleLanguageChange}
              t={t}
            />
          </div>
        )}
      </header>

      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!accessToken ? (
        <LoginPanel
          loading={loading}
          mockUsers={mockUsers}
          t={t}
          onLogin={handleLogin}
          onMockLogin={handleMockLogin}
        />
      ) : (
        <section className="workspace">
          <aside className="side-panel">
            <RepositoryList
              language={language}
              loading={loading}
              promotionSwitch={promotionSwitch}
              repositories={repositories}
              t={t}
              onActivate={handleActivateRepository}
              onPause={handlePauseRepository}
              onResume={handleResumeRepository}
              onSubmit={handleRepositorySubmit}
            />
          </aside>

          <section className="main-panel">
            <TaskCard
              language={language}
              task={currentTask}
              loading={loading}
              t={t}
              onInitialLoad={refresh}
              onReport={handleReportRepository}
              onStar={handleStar}
              onSkip={handleSkip}
            />
          </section>

          <aside className="side-panel">
            <CreditPanel language={language} user={user} ledger={ledger} t={t} />
            {user?.isAdmin ? (
              <AdminPanel
                language={language}
                loading={loading}
                reports={adminReports}
                system={adminSystem}
                t={t}
                onCleanup={handleAdminCleanup}
                onRepositoryAction={handleAdminRepositoryAction}
                onSuspendUser={handleSuspendUser}
              />
            ) : null}
          </aside>
        </section>
      )}
    </main>
  );
}

function LoginPanel({
  loading,
  mockUsers,
  t,
  onLogin,
  onMockLogin,
}: {
  loading: boolean;
  mockUsers: MockUser[];
  t: Translator;
  onLogin: () => void;
  onMockLogin: (login: string) => void;
}) {
  return (
    <section className="login-layout onboarding-layout">
      <section className="onboarding-copy">
        <span className="eyebrow">StarBuddy</span>
        <h2>{t('introHeadline')}</h2>
        <p>{t('introCopy')}</p>
        <div className="permission-list">
          <span>{t('permissionProfile')}</span>
          <span>{t('permissionRepositories')}</span>
          <span>{t('permissionStar')}</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="panel-heading">
          <Github size={22} />
          <div>
            <h2>{t('continueWithGithub')}</h2>
            <p>{t('githubOAuthHelp')}</p>
          </div>
        </div>
        <button className="primary-button" disabled={loading} onClick={onLogin}>
          {loading ? <Loader2 className="spin" size={18} /> : <Github size={18} />}
          {t('continue')}
        </button>
        {mockUsers.length > 0 ? (
          <div className="mock-login-panel">
            <strong>{t('mockLogin')}</strong>
            <div>
              {mockUsers.map((mockUser) => (
                <button
                  className="inline-button"
                  disabled={loading}
                  key={mockUser.githubLogin}
                  onClick={() => onMockLogin(mockUser.githubLogin)}
                  type="button"
                >
                  {mockUser.avatarUrl ? <img src={mockUser.avatarUrl} alt="" /> : null}
                  {mockUser.githubLogin}
                  {mockUser.isAdmin ? <Shield size={13} /> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function RepositoryList({
  language,
  loading,
  promotionSwitch,
  repositories,
  t,
  onActivate,
  onPause,
  onResume,
  onSubmit,
}: {
  language: Language;
  loading: boolean;
  promotionSwitch: PromotionSwitchStatus | null;
  repositories: GithubRepository[];
  t: Translator;
  onActivate: (repositoryId: string) => void;
  onPause: (repositoryId: string) => void;
  onResume: (repositoryId: string) => void;
  onSubmit: (githubRepoId: string) => void;
}) {
  const submittedCount = repositories.filter(
    (repository) => repository.submittedRepository,
  ).length;
  const switchRemainingMs = usePromotionSwitchRemainingMs(promotionSwitch);
  const canSwitch =
    promotionSwitch === null ||
    promotionSwitch.canSwitch ||
    switchRemainingMs <= 0;
  const showSwitchCountdown =
    promotionSwitch !== null &&
    promotionSwitch.switchUsedToday &&
    switchRemainingMs > 0;

  return (
    <section className="tool-panel repository-panel">
      <div className="panel-title">
        <Github size={18} />
        <h2>{t('yourProjects')}</h2>
      </div>
      {repositories.length > 0 ? (
        <p className="muted">
          {t('submittedCount', {
            submitted: submittedCount,
            total: repositories.length,
          })}
        </p>
      ) : null}
      {showSwitchCountdown ? (
        <p className="promotion-reset">
          {t('switchResetCountdown', {
            time: formatDuration(switchRemainingMs),
          })}
        </p>
      ) : null}
      <div className="compact-list repository-list">
        {loading && repositories.length === 0 ? (
          <div className="loading-state">
            <Loader2 className="spin" size={20} />
            <span>{t('loadingProjects')}</span>
          </div>
        ) : repositories.length === 0 ? (
          <p className="muted">{t('noPublicRepositories')}</p>
        ) : (
          <>
            {loading ? (
              <div className="loading-state compact-loading">
                <Loader2 className="spin" size={18} />
                <span>{t('refreshingProjects')}</span>
              </div>
            ) : null}
            {repositories.map((repository) => {
              const submitted = repository.submittedRepository;
              const description =
                submitted?.description ??
                repository.description ??
                t('descriptionFallback');
              const starsCount =
                submitted?.starsCountSnapshot ?? repository.starsCountSnapshot;

              return (
                <div className="repository-row" key={repository.githubRepoId}>
                  <div className="repository-main">
                    <div className="repository-heading">
                      <strong>
                        {repository.githubOwner}/{repository.githubRepo}
                      </strong>
                      <span className="repository-stars">
                        <Star size={14} />
                        {starsCount} {t('stars')}
                      </span>
                    </div>
                    <p className="repository-description">{description}</p>
                    <div className="repository-meta-line">
                      {submitted ? (
                        <span className={`status-pill status-${submitted.status}`}>
                          {formatStatus(language, submitted.status)}
                        </span>
                      ) : (
                        <span className="repository-source">GitHub</span>
                      )}
                    </div>
                  </div>
                  <div className="repository-controls">
                    {!submitted ? (
                      <button
                        className="inline-button"
                        disabled={loading}
                        onClick={() => onSubmit(repository.githubRepoId)}
                      >
                        <Plus size={15} />
                        {t('submit')}
                      </button>
                    ) : null}
                    {submitted?.status === 'active' ? (
                      <button
                        className="inline-button"
                        disabled={loading}
                        onClick={() => onPause(submitted.id)}
                      >
                        <Pause size={14} />
                        {t('pausePromotion')}
                      </button>
                    ) : null}
                    {submitted?.status === 'paused' ? (
                      <button
                        className="inline-button"
                        disabled={loading}
                        onClick={() => onResume(submitted.id)}
                      >
                        <Play size={14} />
                        {t('resumePromotion')}
                      </button>
                    ) : null}
                    {submitted?.status === 'inactive' ? (
                      <button
                        className="inline-button"
                        disabled={loading || !canSwitch}
                        onClick={() => onActivate(submitted.id)}
                      >
                        <Star size={14} />
                        {t('activatePromotion')}
                      </button>
                    ) : null}
                  </div>
                  {submitted ? (
                    <div className="repository-star-summary">
                      <div className="star-summary-count">
                        <Star size={15} />
                        <strong>
                          {t('starBuddyStars', {
                            count: submitted.starBuddyStarsCount,
                          })}
                        </strong>
                      </div>
                      {submitted.recentStars.length > 0 ? (
                        <div className="stargazer-list">
                          <span>{t('recentStargazers')}</span>
                          <div>
                            {submitted.recentStars.map((star) => (
                              <span className="stargazer-chip" key={star.id}>
                                {star.actor.avatarUrl ? (
                                  <img src={star.actor.avatarUrl} alt="" />
                                ) : null}
                                {star.actor.githubLogin}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="muted">{t('noStarBuddyStars')}</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

function usePromotionSwitchRemainingMs(
  promotionSwitch: PromotionSwitchStatus | null,
) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!promotionSwitch || promotionSwitch.canSwitch) {
      setRemainingMs(0);
      return;
    }

    const serverNowMs = Date.parse(promotionSwitch.serverNow);
    const resetMs = Date.parse(promotionSwitch.nextSwitchResetAt);
    const clientOffsetMs = serverNowMs - Date.now();

    function updateRemaining() {
      setRemainingMs(Math.max(0, resetMs - (Date.now() + clientOffsetMs)));
    }

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [
    promotionSwitch?.canSwitch,
    promotionSwitch?.nextSwitchResetAt,
    promotionSwitch?.serverNow,
  ]);

  return remainingMs;
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':');
}

function TaskCard({
  language,
  task,
  loading,
  t,
  onInitialLoad,
  onReport,
  onStar,
  onSkip,
}: {
  language: Language;
  task: CurrentTask | EmptyTask | null;
  loading: boolean;
  t: Translator;
  onInitialLoad: () => void;
  onReport: (repositoryId: string) => void;
  onStar: (claimId: string) => void;
  onSkip: (claimId: string) => void;
}) {
  if (!task) {
    return (
      <section className="project-card empty-card">
        <Star size={34} />
        <h2>{t('projectQueueReady')}</h2>
        <p>{t('projectQueueReadyHelp')}</p>
        <button className="primary-button" disabled={loading} onClick={onInitialLoad}>
          {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          {t('loadRecommendation')}
        </button>
      </section>
    );
  }

  if (task.status === 'no_task_available') {
    return (
      <section className="project-card empty-card">
        <Github size={34} />
        <h2>{t('noProjectsAvailable')}</h2>
        <p>{t('noProjectsAvailableHelp')}</p>
        <button className="secondary-button" disabled={loading} onClick={onInitialLoad}>
          <RefreshCw size={17} />
          {t('refresh')}
        </button>
      </section>
    );
  }

  if (task.status === 'tasks_disabled') {
    return (
      <section className="project-card empty-card">
        <Shield size={34} />
        <h2>{t('tasksDisabled')}</h2>
        <p>{t('noProjectsAvailableHelp')}</p>
      </section>
    );
  }

  if (task.status === 'account_suspended') {
    return (
      <section className="project-card empty-card">
        <Ban size={34} />
        <h2>{t('userSuspended')}</h2>
        <p>{t('noProjectsAvailableHelp')}</p>
      </section>
    );
  }

  if (task.status === 'daily_user_limit_reached') {
    return (
      <section className="project-card empty-card">
        <Star size={34} />
        <h2>{t('dailyLimitReached')}</h2>
        <button className="secondary-button" disabled={loading} onClick={onInitialLoad}>
          <RefreshCw size={17} />
          {t('refresh')}
        </button>
      </section>
    );
  }

  if (task.status !== 'available') {
    return null;
  }

  return (
    <section className="project-card">
      <div className="project-meta">
        <span>{t('recommendedProject')}</span>
        <span>
          +{task.rewardCredits} {t('creditUnit')}
        </span>
      </div>
      <h2>{task.repository.fullName}</h2>
      <p className="description">
        {task.repository.description ?? t('descriptionFallback')}
      </p>
      <div className="stats-strip">
        <div>
          <strong>{task.repository.starsCountSnapshot}</strong>
          <span>{t('stars')}</span>
        </div>
        <div>
          <strong>{new Date(task.expiresAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US')}</strong>
          <span>{t('claimExpires')}</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="ghost-action"
          disabled={loading}
          onClick={() => onSkip(task.claimId)}
        >
          <X size={18} />
          {t('skip')}
        </button>
        <button
          className="ghost-action"
          disabled={loading}
          onClick={() => onReport(task.repository.id)}
        >
          <Flag size={18} />
          {t('reportProject')}
        </button>
        <button
          className="primary-action"
          disabled={loading}
          onClick={() => onStar(task.claimId)}
        >
          {loading ? <Loader2 className="spin" size={20} /> : <Star size={20} />}
          {t('starThisProject')}
        </button>
      </div>
    </section>
  );
}

function CreditPanel({
  language,
  user,
  ledger,
  t,
}: {
  language: Language;
  user: User | null;
  ledger: CreditLedgerEntry[];
  t: Translator;
}) {
  return (
    <section className="tool-panel">
      <div className="panel-title">
        <WalletCards size={18} />
        <h2>{t('credits')}</h2>
      </div>
      <div className="balance">{user?.creditsBalance ?? 0}</div>
      <div className="compact-list">
        {ledger.length === 0 ? (
          <p className="muted">{t('noCreditActivity')}</p>
        ) : (
          ledger.slice(0, 8).map((entry) => (
            <div className="compact-row" key={entry.id}>
              <strong className={entry.amount > 0 ? 'positive' : 'negative'}>
                {entry.amount > 0 ? '+' : ''}
                {entry.amount}
              </strong>
              <span>{formatLedgerReason(language, entry.reason)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AdminPanel({
  language,
  loading,
  reports,
  system,
  t,
  onCleanup,
  onRepositoryAction,
  onSuspendUser,
}: {
  language: Language;
  loading: boolean;
  reports: RepositoryReport[];
  system: AdminSystemStatus | null;
  t: Translator;
  onCleanup: () => void;
  onRepositoryAction: (
    repositoryId: string,
    action: 'archive' | 'reject' | 'restore',
  ) => void;
  onSuspendUser: (userId: string) => void;
}) {
  return (
    <section className="tool-panel admin-panel">
      <div className="panel-title">
        <Shield size={18} />
        <h2>{t('admin')}</h2>
      </div>

      <div className="admin-system">
        <strong>{t('adminSystem')}</strong>
        <span className={system?.starTasksEnabled ? 'positive' : 'negative'}>
          tasks: {system?.starTasksEnabled ? 'on' : 'off'}
        </span>
        <span className={system?.repositoryPromotionEnabled ? 'positive' : 'negative'}>
          promotion: {system?.repositoryPromotionEnabled ? 'on' : 'off'}
        </span>
      </div>

      <button className="secondary-button" disabled={loading} onClick={onCleanup}>
        <Trash2 size={16} />
        {t('adminCleanup')}
      </button>

      <div className="admin-reports">
        <strong>{t('adminReports')}</strong>
        {reports.length === 0 ? (
          <p className="muted">{t('noReports')}</p>
        ) : (
          reports.map((report) => (
            <div className="admin-report-row" key={report.id}>
              <div>
                <strong>
                  {report.repository.githubOwner}/{report.repository.githubRepo}
                </strong>
                <span>
                  {formatStatus(language, report.repository.status)} · @
                  {report.reporter.githubLogin}
                </span>
                {report.reason ? <p>{report.reason}</p> : null}
              </div>
              <div className="admin-actions">
                <button
                  className="inline-button"
                  disabled={loading}
                  onClick={() => onRepositoryAction(report.repository.id, 'archive')}
                >
                  <Archive size={14} />
                  {t('archiveRepository')}
                </button>
                <button
                  className="inline-button"
                  disabled={loading}
                  onClick={() => onRepositoryAction(report.repository.id, 'reject')}
                >
                  <Ban size={14} />
                  {t('rejectRepository')}
                </button>
                <button
                  className="inline-button"
                  disabled={loading}
                  onClick={() => onRepositoryAction(report.repository.id, 'restore')}
                >
                  <RotateCcw size={14} />
                  {t('restoreRepository')}
                </button>
                <button
                  className="inline-button"
                  disabled={loading}
                  onClick={() => onSuspendUser(report.reporter.id)}
                >
                  <Shield size={14} />
                  {t('suspendReporter')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function LanguageSwitcher({
  language,
  t,
  onChange,
}: {
  language: Language;
  t: Translator;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-switcher" aria-label="Language">
      {(['en', 'zh'] as const).map((option) => (
        <button
          className={language === option ? 'active' : undefined}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === 'en' ? t('languageEnglish') : t('languageChinese')}
        </button>
      ))}
    </div>
  );
}

type Translator = (
  key: Parameters<typeof translate>[1],
  values?: Parameters<typeof translate>[2],
) => string;

function resultMessage(language: Language, result: TaskResult) {
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(language, key, values);

  if (result.status === 'completed_rewarded') {
    return t('starCompletedRewarded', { repository: result.repository ?? '' });
  }
  if (result.status === 'already_starred_no_reward') {
    return t('alreadyStarredNoReward', { repository: result.repository ?? '' });
  }
  if (result.status === 'completed_unrewarded_insufficient_credits') {
    return t('repositoryNoCredits', { repository: result.repository ?? '' });
  }
  return formatStatus(language, result.status);
}

function errorMessage(error: unknown, t: Translator) {
  return error instanceof Error ? error.message : t('errorFallback');
}

function oauthErrorMessage(error: string, t: Translator) {
  if (error === 'access_denied') {
    return t('oauthAccessDenied');
  }
  if (error === 'insufficient_scope') {
    return t('oauthInsufficientScope');
  }
  if (error === 'state_mismatch') {
    return t('oauthStateMismatch');
  }
  return t('oauthFailed');
}
