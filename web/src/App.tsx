import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Github,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Star,
  WalletCards,
  X,
} from 'lucide-react';
import {
  API_BASE_URL,
  ApiClient,
  CreditLedgerEntry,
  CurrentTask,
  EmptyTask,
  GithubRepository,
  Repository,
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
      setRepositories(mine);
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

  async function handleRepositorySubmit(url: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const repository = await api.createRepository(url);
      setRepositories((items) => mergeSubmittedRepository(items, repository));
      setMessage(
        t('projectAdded', {
          repository: `${repository.githubOwner}/${repository.githubRepo}`,
        }),
      );
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
        <LoginPanel loading={loading} t={t} onLogin={handleLogin} />
      ) : (
        <section className="workspace">
          <aside className="side-panel">
            <RepositoryList
              language={language}
              loading={loading}
              repositories={repositories}
              t={t}
              onSubmit={handleRepositorySubmit}
            />
            <RepositoryForm loading={loading} t={t} onSubmit={handleRepositorySubmit} />
          </aside>

          <section className="main-panel">
            <TaskCard
              language={language}
              task={currentTask}
              loading={loading}
              t={t}
              onInitialLoad={refresh}
              onStar={handleStar}
              onSkip={handleSkip}
            />
          </section>

          <aside className="side-panel">
            <CreditPanel language={language} user={user} ledger={ledger} t={t} />
          </aside>
        </section>
      )}
    </main>
  );
}

function LoginPanel({
  loading,
  t,
  onLogin,
}: {
  loading: boolean;
  t: Translator;
  onLogin: () => void;
}) {
  return (
    <section className="login-layout">
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
      </section>
    </section>
  );
}

function RepositoryForm({
  loading,
  t,
  onSubmit,
}: {
  loading: boolean;
  t: Translator;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(url);
    setUrl('');
  }

  return (
    <form className="tool-panel" onSubmit={submit}>
      <div className="panel-title">
        <Plus size={18} />
        <h2>{t('addRepository')}</h2>
      </div>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://github.com/owner/repo"
      />
      <button className="secondary-button" disabled={loading || !url}>
        <Send size={17} />
        {t('submit')}
      </button>
    </form>
  );
}

function RepositoryList({
  language,
  loading,
  repositories,
  t,
  onSubmit,
}: {
  language: Language;
  loading: boolean;
  repositories: GithubRepository[];
  t: Translator;
  onSubmit: (url: string) => void;
}) {
  const submittedCount = repositories.filter(
    (repository) => repository.submittedRepository,
  ).length;

  return (
    <section className="tool-panel">
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

              return (
                <div className="repository-row" key={repository.githubRepoId}>
                  <div>
                    <strong>
                      {repository.githubOwner}/{repository.githubRepo}
                    </strong>
                    <span>
                      {submitted?.starTask?.status
                        ? formatStatus(language, submitted.starTask.status)
                        : submitted?.status
                          ? formatStatus(language, submitted.status)
                          : `${repository.starsCountSnapshot} ${t('stars')}`}
                    </span>
                  </div>
                  {submitted ? (
                    <span className="status-pill">{t('submitted')}</span>
                  ) : (
                    <button
                      className="inline-button"
                      disabled={loading}
                      onClick={() =>
                        onSubmit(
                          `https://github.com/${repository.githubOwner}/${repository.githubRepo}`,
                        )
                      }
                    >
                      <Plus size={15} />
                      {t('submit')}
                    </button>
                  )}
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

function TaskCard({
  language,
  task,
  loading,
  t,
  onInitialLoad,
  onStar,
  onSkip,
}: {
  language: Language;
  task: CurrentTask | EmptyTask | null;
  loading: boolean;
  t: Translator;
  onInitialLoad: () => void;
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

function mergeSubmittedRepository(
  repositories: GithubRepository[],
  submittedRepository: Repository,
) {
  const nextRepositories = repositories.map((repository) => {
    if (repository.githubRepoId !== submittedRepository.githubRepoId) {
      return repository;
    }

    return {
      ...repository,
      submittedRepository,
    };
  });

  if (
    nextRepositories.some(
      (repository) => repository.githubRepoId === submittedRepository.githubRepoId,
    )
  ) {
    return nextRepositories;
  }

  return [
    {
      githubRepoId: submittedRepository.githubRepoId,
      githubOwner: submittedRepository.githubOwner,
      githubRepo: submittedRepository.githubRepo,
      description: submittedRepository.description,
      starsCountSnapshot: submittedRepository.starsCountSnapshot,
      submittedRepository,
    },
    ...nextRepositories,
  ];
}
