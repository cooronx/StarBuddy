import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  BookOpen,
  Clock3,
  Flag,
  Github,
  History,
  Languages,
  LayoutDashboard,
  Loader2,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Star,
  Terminal,
  WalletCards,
} from 'lucide-react';
import {
  API_BASE_URL,
  ApiClient,
  CreditLedgerEntry,
  CurrentTask,
  EmptyTask,
  GithubRepository,
  MockUser,
  PromotionSwitchStatus,
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

type View = 'dashboard' | 'tasks' | 'repositories' | 'history';

const views: Array<{
  id: View;
  icon: typeof LayoutDashboard;
  label: Record<Language, string>;
}> = [
  { id: 'dashboard', icon: LayoutDashboard, label: { en: 'Dashboard', zh: '仪表盘' } },
  { id: 'tasks', icon: Star, label: { en: 'Tasks', zh: '任务' } },
  { id: 'repositories', icon: Terminal, label: { en: 'Repositories', zh: '仓库' } },
  { id: 'history', icon: History, label: { en: 'History', zh: '历史' } },
];

export function App() {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const [activeView, setActiveView] = useState<View>(() => readHashView());
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
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => new ApiClient(() => accessToken), [accessToken]);
  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
      translate(language, key, values),
    [language],
  );
  const activePromotion = useMemo(
    () =>
      repositories.find(
        (repository) => repository.submittedRepository?.status === 'active',
      ) ?? null,
    [repositories],
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
    } catch (refreshError) {
      setError(errorMessage(refreshError, t));
    } finally {
      setLoading(false);
    }
  }, [accessToken, api, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleHashChange() {
      setActiveView(readHashView());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  function setView(view: View) {
    setActiveView(view);
    window.history.replaceState({}, '', `#${view}`);
  }

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
  }

  function handleLanguageChange(nextLanguage: Language) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguage(nextLanguage);
  }

  if (!accessToken) {
    return (
      <LoginScreen
        error={error}
        language={language}
        loading={loading}
        message={message}
        mockUsers={mockUsers}
        t={t}
        onLanguageChange={handleLanguageChange}
        onLogin={handleLogin}
        onMockLogin={handleMockLogin}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-background">
      <Sidebar
        activeView={activeView}
        language={language}
        onNewPromotion={() => setView('repositories')}
        onViewChange={setView}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar
          activePromotion={activePromotion}
          language={language}
          loading={loading}
          user={user}
          t={t}
          onLanguageChange={handleLanguageChange}
          onLogout={handleLogout}
          onRefresh={refresh}
        />

        <main className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-6 md:px-6 lg:px-10">
          <div className="mx-auto max-w-container-max space-y-5">
            <MobileNav
              activeView={activeView}
              language={language}
              onViewChange={setView}
            />
            <FlashMessages error={error} message={message} />
            {activeView === 'dashboard' ? (
              <DashboardView
                language={language}
                ledger={ledger}
                loading={loading}
                repositories={repositories}
                task={currentTask}
                t={t}
                user={user}
                onGoRepositories={() => setView('repositories')}
                onGoTasks={() => setView('tasks')}
                onRefresh={refresh}
              />
            ) : null}
            {activeView === 'tasks' ? (
              <TasksView
                language={language}
                loading={loading}
                task={currentTask}
                t={t}
                user={user}
                onRefresh={refresh}
                onReport={handleReportRepository}
                onStar={handleStar}
              />
            ) : null}
            {activeView === 'repositories' ? (
              <RepositoriesView
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
            ) : null}
            {activeView === 'history' ? (
              <HistoryView
                language={language}
                ledger={ledger}
                repositories={repositories}
                t={t}
                user={user}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function LoginScreen({
  error,
  language,
  loading,
  message,
  mockUsers,
  t,
  onLanguageChange,
  onLogin,
  onMockLogin,
}: {
  error: string;
  language: Language;
  loading: boolean;
  message: string;
  mockUsers: MockUser[];
  t: Translator;
  onLanguageChange: (language: Language) => void;
  onLogin: () => void;
  onMockLogin: (login: string) => void;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-on-background md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-secondary credit-loop">
              <Star size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-on-surface">StarBuddy</h1>
              <p className="label-caps text-on-surface-variant">
                Star Coordination
              </p>
            </div>
          </div>
          <LanguageSwitcher
            language={language}
            t={t}
            onChange={onLanguageChange}
          />
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="max-w-2xl space-y-6">
            <span className="status-badge border-primary/30 bg-primary/10 text-primary">
              Developer-first growth loop
            </span>
            <div className="space-y-4">
              <h2 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-on-surface md:text-6xl">
                {t('introHeadline')}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-on-surface-variant md:text-lg">
                {t('introCopy')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[t('permissionProfile'), t('permissionRepositories'), t('permissionStar')].map(
                (permission) => (
                  <div className="surface-panel-low p-4" key={permission}>
                    <BadgeCheck className="mb-3 text-tertiary" size={18} />
                    <p className="text-sm text-on-surface">{permission}</p>
                  </div>
                ),
              )}
            </div>
          </div>

          <section className="surface-panel-low p-5 md:p-6">
            <FlashMessages error={error} message={message} />
            <div className="mb-6 flex items-start gap-3">
              <Github className="mt-1 text-primary" size={24} />
              <div>
                <h2 className="text-xl font-semibold text-on-surface">
                  {t('continueWithGithub')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  {t('githubOAuthHelp')}
                </p>
              </div>
            </div>
            <button
              className="primary-button w-full"
              disabled={loading}
              onClick={onLogin}
              type="button"
            >
              {loading ? <Loader2 className="spin" size={18} /> : <Github size={18} />}
              {t('continue')}
            </button>
            {mockUsers.length > 0 ? (
              <div className="mt-6 border-t border-outline-variant pt-5">
                <strong className="label-caps text-on-surface-variant">
                  {t('mockLogin')}
                </strong>
                <div className="mt-3 grid gap-2">
                  {mockUsers.map((mockUser) => (
                    <button
                      className="secondary-button justify-start"
                      disabled={loading}
                      key={mockUser.githubLogin}
                      onClick={() => onMockLogin(mockUser.githubLogin)}
                      type="button"
                    >
                      {mockUser.avatarUrl ? (
                        <img
                          alt=""
                          className="h-6 w-6 rounded-full border border-outline-variant"
                          src={mockUser.avatarUrl}
                        />
                      ) : (
                        <Github size={18} />
                      )}
                      <span className="mono">@{mockUser.githubLogin}</span>
                      {mockUser.isAdmin ? <Shield size={14} /> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function Sidebar({
  activeView,
  language,
  onNewPromotion,
  onViewChange,
}: {
  activeView: View;
  language: Language;
  onNewPromotion: () => void;
  onViewChange: (view: View) => void;
}) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low p-4 md:flex">
      <div className="mb-6 px-2">
        <h1 className="text-2xl font-semibold text-on-surface">Developer Portal</h1>
        <p className="label-caps mt-1 text-on-surface-variant">Star Coordination</p>
      </div>
      <nav className="flex-1 space-y-1">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <button
              className={`nav-item w-full ${activeView === view.id ? 'nav-item-active' : ''}`}
              key={view.id}
              onClick={() => onViewChange(view.id)}
              type="button"
            >
              <Icon size={20} />
              {view.label[language]}
            </button>
          );
        })}
      </nav>
      <button className="primary-button w-full" onClick={onNewPromotion} type="button">
        <Plus size={18} />
        {label(language, 'New Promotion', '新推广')}
      </button>
    </aside>
  );
}

function Topbar({
  activePromotion,
  language,
  loading,
  user,
  t,
  onLanguageChange,
  onLogout,
  onRefresh,
}: {
  activePromotion: GithubRepository | null;
  language: Language;
  loading: boolean;
  user: User | null;
  t: Translator;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  return (
    <header className="flex min-h-16 items-center justify-between border-b border-outline-variant bg-background px-4 md:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-secondary">
          <Star size={18} fill="currentColor" />
        </div>
        <strong className="text-lg text-primary">StarBuddy</strong>
      </div>
      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <p className="label-caps text-on-surface-variant">
          {label(language, 'Collaborative Growth Engine', '协作增长引擎')}
        </p>
        <ActivePromotionPill
          language={language}
          repository={activePromotion}
        />
      </div>
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 sm:flex">
          <Star className="text-secondary" size={16} fill="currentColor" />
          <span className="mono text-on-surface">{user?.creditsBalance ?? 0} CR</span>
        </div>
        <LanguageSwitcher language={language} t={t} onChange={onLanguageChange} />
        <button className="icon-button" onClick={onRefresh} title={t('refresh')}>
          {loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
        </button>
        <div className="hidden min-w-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-2 py-1.5 sm:flex">
          {user?.avatarUrl ? (
            <img alt="" className="h-7 w-7 rounded-full" src={user.avatarUrl} />
          ) : (
            <Github size={18} />
          )}
          <span className="mono max-w-32 truncate text-on-surface">
            @{user?.githubLogin}
          </span>
        </div>
        <button className="ghost-button" onClick={onLogout} type="button">
          <LogOut size={16} />
          <span className="hidden sm:inline">{t('signOut')}</span>
        </button>
      </div>
    </header>
  );
}

function ActivePromotionPill({
  language,
  repository,
}: {
  language: Language;
  repository: GithubRepository | null;
}) {
  if (!repository?.submittedRepository) {
    return null;
  }

  return (
    <div className="hidden min-w-0 max-w-[280px] items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-1.5 shadow-ring lg:flex">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="label-caps shrink-0 text-on-surface-variant">
        {label(language, 'Promoting', '推广中')}
      </span>
      <span className="mono min-w-0 truncate text-on-surface">
        {repository.githubOwner}/{repository.githubRepo}
      </span>
    </div>
  );
}

function MobileNav({
  activeView,
  language,
  onViewChange,
}: {
  activeView: View;
  language: Language;
  onViewChange: (view: View) => void;
}) {
  return (
    <nav className="grid grid-cols-4 gap-2 md:hidden">
      {views.map((view) => {
        const Icon = view.icon;
        return (
          <button
            className={`nav-item justify-center px-2 ${activeView === view.id ? 'nav-item-active' : ''}`}
            key={view.id}
            onClick={() => onViewChange(view.id)}
            type="button"
          >
            <Icon size={18} />
            <span className="sr-only">{view.label[language]}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DashboardView({
  language,
  ledger,
  loading,
  repositories,
  task,
  t,
  user,
  onGoRepositories,
  onGoTasks,
  onRefresh,
}: {
  language: Language;
  ledger: CreditLedgerEntry[];
  loading: boolean;
  repositories: GithubRepository[];
  task: CurrentTask | EmptyTask | null;
  t: Translator;
  user: User | null;
  onGoRepositories: () => void;
  onGoTasks: () => void;
  onRefresh: () => void;
}) {
  const submitted = repositories.filter((repo) => repo.submittedRepository);
  const active = submitted.find((repo) => repo.submittedRepository?.status === 'active');
  const earned = ledger
    .filter((entry) => entry.amount > 0)
    .reduce((total, entry) => total + entry.amount, 0);
  const spent = Math.abs(
    ledger
      .filter((entry) => entry.amount < 0)
      .reduce((total, entry) => total + entry.amount, 0),
  );

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow={label(language, 'Overview', '总览')}
        title={label(language, 'Credit Loop', '积分循环')}
        description={label(
          language,
          'Track the exchange between tasks you complete and repositories you promote.',
          '追踪你完成任务和推广仓库之间的积分流转。',
        )}
        right={
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <span className="h-2 w-2 rounded-full bg-tertiary" />
            {label(language, 'System Online', '系统在线')}
          </div>
        }
      />

      <section className="surface-panel-low relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-container opacity-10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-3">
          <MetricBlock
            icon={<Star size={22} fill="currentColor" />}
            label={t('credits')}
            tone="text-secondary"
            value={String(user?.creditsBalance ?? 0)}
          />
          <MetricBlock
            icon={<ArrowRight size={22} />}
            label={label(language, 'Credits earned', '已赚积分')}
            tone="text-tertiary"
            value={`+${earned}`}
          />
          <MetricBlock
            icon={<WalletCards size={22} />}
            label={label(language, 'Credits spent', '已消耗积分')}
            tone="text-primary"
            value={`-${spent}`}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="surface-panel p-5 lg:col-span-7">
          <SectionTitle
            icon={<Star size={18} />}
            title={label(language, 'Current Task', '当前任务')}
          />
          <CompactTaskSummary
            language={language}
            loading={loading}
            task={task}
            t={t}
            onGoTasks={onGoTasks}
            onRefresh={onRefresh}
          />
        </section>

        <section className="surface-panel p-5 lg:col-span-5">
          <SectionTitle
            icon={<Terminal size={18} />}
            title={label(language, 'Promotion Slot', '推广位')}
          />
          {active ? (
            <RepositorySummaryCard language={language} repository={active} t={t} />
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">
                {label(
                  language,
                  'No active repository is using the promotion slot.',
                  '当前没有仓库占用推广位。',
                )}
              </p>
              <button className="primary-button mt-4" onClick={onGoRepositories}>
                <Plus size={16} />
                {label(language, 'Choose Repository', '选择仓库')}
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-4 py-3">
          <SectionTitle
            icon={<History size={18} />}
            title={label(language, 'Recent Contribution History', '最近贡献记录')}
          />
          <span className="mono text-on-surface-variant">{ledger.length}</span>
        </div>
        <LedgerList language={language} ledger={ledger.slice(0, 5)} t={t} />
      </section>
    </section>
  );
}

function TasksView({
  language,
  loading,
  task,
  t,
  user,
  onRefresh,
  onReport,
  onStar,
}: {
  language: Language;
  loading: boolean;
  task: CurrentTask | EmptyTask | null;
  t: Translator;
  user: User | null;
  onRefresh: () => void;
  onReport: (repositoryId: string) => void;
  onStar: (claimId: string) => void;
}) {
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow={label(language, 'Star Tasks', 'Star 任务')}
        title={label(language, 'Discover repositories seeking stars.', '发现正在寻求 Star 的仓库。')}
        description={label(
          language,
          'Complete eligible tasks to earn credits for your own promotion slot.',
          '完成符合条件的任务，为你自己的推广位赚取积分。',
        )}
        right={
          <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5">
            <Star className="text-secondary" size={16} fill="currentColor" />
            <span className="mono text-on-surface">{user?.creditsBalance ?? 0} CR</span>
          </div>
        }
      />
      <TaskPanel
        language={language}
        loading={loading}
        task={task}
        t={t}
        onRefresh={onRefresh}
        onReport={onReport}
        onStar={onStar}
      />
    </section>
  );
}

function RepositoriesView({
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
  const [query, setQuery] = useState('');
  const switchRemainingMs = usePromotionSwitchRemainingMs(promotionSwitch);
  const canSwitch =
    promotionSwitch === null ||
    promotionSwitch.canSwitch ||
    switchRemainingMs <= 0;
  const filteredRepositories = repositories.filter((repository) =>
    `${repository.githubOwner}/${repository.githubRepo}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const submittedCount = repositories.filter(
    (repository) => repository.submittedRepository,
  ).length;
  const activeCount = repositories.filter(
    (repository) => repository.submittedRepository?.status === 'active',
  ).length;

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow={label(language, 'Repository Management', '仓库管理')}
        title={label(language, 'My Promoted Repositories', '我的推广仓库')}
        description={label(
          language,
          'Manage the public repositories eligible for StarBuddy promotion.',
          '管理可参与 StarBuddy 推广的公开仓库。',
        )}
        right={
          <div className="surface-panel flex items-center gap-3 px-3 py-2">
            <span className="label-caps text-on-surface-variant">
              {label(language, 'Promotion Slot', '推广位')}
            </span>
            <span className="mono text-tertiary">{activeCount}/1</span>
          </div>
        }
      />

      <section className="surface-panel p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-on-surface-variant">
              {t('submittedCount', {
                submitted: submittedCount,
                total: repositories.length,
              })}
            </p>
            {promotionSwitch?.switchUsedToday && switchRemainingMs > 0 ? (
              <p className="mono mt-1 text-secondary">
                {t('switchResetCountdown', { time: formatDuration(switchRemainingMs) })}
              </p>
            ) : null}
          </div>
          <label className="relative block w-full md:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              size={18}
            />
            <input
              className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-low pl-10 pr-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={label(language, 'Search repositories...', '搜索仓库...')}
              value={query}
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4">
        {loading && repositories.length === 0 ? (
          <LoadingBlock text={t('loadingProjects')} />
        ) : filteredRepositories.length === 0 ? (
          <EmptyBlock
            icon={<BookOpen size={28} />}
            title={t('noPublicRepositories')}
            description={t('noProjectsAvailableHelp')}
          />
        ) : (
          filteredRepositories.map((repository) => (
            <RepositoryRow
              canSwitch={canSwitch}
              key={repository.githubRepoId}
              language={language}
              loading={loading}
              repository={repository}
              t={t}
              onActivate={onActivate}
              onPause={onPause}
              onResume={onResume}
              onSubmit={onSubmit}
            />
          ))
        )}
      </div>
    </section>
  );
}

function HistoryView({
  language,
  ledger,
  repositories,
  t,
  user,
}: {
  language: Language;
  ledger: CreditLedgerEntry[];
  repositories: GithubRepository[];
  t: Translator;
  user: User | null;
}) {
  const earned = ledger
    .filter((entry) => entry.amount > 0)
    .reduce((total, entry) => total + entry.amount, 0);
  const spent = Math.abs(
    ledger
      .filter((entry) => entry.amount < 0)
      .reduce((total, entry) => total + entry.amount, 0),
  );
  const rewardEntries = ledger.filter(
    (entry) => entry.reason === 'star_completed_reward' && entry.amount > 0,
  );
  const starsGiven = rewardEntries.length;
  const receivedStars = getReceivedStars(repositories);
  const starsReceived = repositories.reduce(
    (total, repository) =>
      total + (repository.submittedRepository?.starBuddyStarsCount ?? 0),
    0,
  );
  const lifetimeImpact = starsGiven + starsReceived;

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow={label(language, 'Contribution History', '贡献历史')}
        title={label(language, 'Review your lifetime impact.', '回顾你的长期贡献。')}
        description={label(
          language,
          'Track earned credits, promotion spend, and the effective contribution log.',
          '追踪积分收入、推广消耗和有效贡献记录。',
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          <HistoryRewardSchedule language={language} starsGiven={starsGiven} />
          <EffectiveContributionsTable language={language} ledger={ledger} t={t} />
          <StarsReceivedList
            language={language}
            receivedStars={receivedStars.slice(0, 3)}
          />
        </div>

        <aside className="space-y-5">
          <LifetimeImpactCard language={language} value={lifetimeImpact} />
          <ExchangeRatioCard
            language={language}
            starsGiven={starsGiven}
            starsReceived={starsReceived}
          />
          <AvailableCreditsCard
            availableCredits={user?.creditsBalance ?? 0}
            earned={earned}
            language={language}
            spent={spent}
            t={t}
          />
        </aside>
      </div>
    </section>
  );
}

function HistoryRewardSchedule({
  language,
  starsGiven,
}: {
  language: Language;
  starsGiven: number;
}) {
  const firstFiveComplete = Math.min(starsGiven, 5);
  const progressWidth = Math.min(100, Math.max(18, (firstFiveComplete / 5) * 65));

  return (
    <section className="surface-panel p-5 md:p-6">
      <h3 className="mb-6 text-lg font-semibold text-on-surface">
        {label(language, 'Contribution Reward Schedule', '贡献奖励规则')}
      </h3>
      <div className="relative pb-2 pt-4">
        <div className="absolute left-0 right-0 top-8 h-1 rounded-full bg-surface-variant">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="relative grid grid-cols-3 gap-3 text-center">
          <RewardMilestone
            active
            icon={<BadgeCheck size={16} />}
            label={label(language, 'Signup', '注册')}
            value="+5 cr"
          />
          <RewardMilestone
            active={starsGiven > 0}
            icon={<Star size={16} fill="currentColor" />}
            label={label(language, 'First 5 Stars', '前 5 次 Star')}
            value="1 cr / ea"
          />
          <RewardMilestone
            active={starsGiven > 5}
            icon={<RefreshCw size={16} />}
            label={label(language, 'Ongoing', '持续贡献')}
            value={label(language, '1 cr / 2 stars', '每 2 次 1 积分')}
          />
        </div>
      </div>
    </section>
  );
}

function RewardMilestone({
  active,
  icon,
  label: milestoneLabel,
  value,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div
        className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border ${
          active
            ? 'border-primary/30 bg-primary text-on-primary shadow-[0_0_12px_rgba(172,199,255,0.22)]'
            : 'border-outline-variant bg-surface-variant text-on-surface-variant'
        }`}
      >
        {icon}
      </div>
      <span
        className={`label-caps mt-3 max-w-full truncate ${
          active ? 'text-on-surface' : 'text-on-surface-variant'
        }`}
      >
        {milestoneLabel}
      </span>
      <span className={`mono mt-2 ${active ? 'text-tertiary' : 'text-on-surface-variant'}`}>
        {value}
      </span>
    </div>
  );
}

function EffectiveContributionsTable({
  language,
  ledger,
  t,
}: {
  language: Language;
  ledger: CreditLedgerEntry[];
  t: Translator;
}) {
  if (ledger.length === 0) {
    return (
      <EmptyBlock
        icon={<History size={32} />}
        title={label(language, 'No effective contributions yet', '暂无有效贡献')}
        description={t('noCreditActivity')}
      />
    );
  }

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-4 py-3">
        <div className="flex items-center gap-2 text-on-surface">
          <History className="text-primary" size={18} />
          <h3 className="text-lg font-semibold">
            {label(language, 'Effective Contributions', '有效贡献')}
          </h3>
        </div>
        <span className="mono text-on-surface-variant">{ledger.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container">
              <th className="label-caps px-4 py-3 text-on-surface-variant">
                {label(language, 'Source', '来源')}
              </th>
              <th className="label-caps px-4 py-3 text-on-surface-variant">
                {label(language, 'Date', '日期')}
              </th>
              <th className="label-caps px-4 py-3 text-on-surface-variant">
                {label(language, 'Status', '状态')}
              </th>
              <th className="label-caps px-4 py-3 text-right text-on-surface-variant">
                {label(language, 'Credit', '积分')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {ledger.map((entry) => (
              <tr
                className="group transition hover:bg-surface-container-high"
                key={entry.id}
              >
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BookOpen
                      className="shrink-0 text-outline transition group-hover:text-primary"
                      size={18}
                    />
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-on-surface">
                        {formatLedgerReason(language, entry.reason)}
                      </strong>
                      <span className="mono mt-1 block truncate text-on-surface-variant">
                        {entry.relatedEntityType ??
                          label(language, 'Account', '账户')}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-on-surface-variant">
                  {new Date(entry.createdAt).toLocaleDateString(
                    language === 'zh' ? 'zh-CN' : 'en-US',
                  )}
                </td>
                <td className="px-4 py-3">
                  <LedgerStatusBadge entry={entry} language={language} />
                </td>
                <td
                  className={`mono px-4 py-3 text-right text-base ${ledgerAmountClass(
                    entry.amount,
                  )}`}
                >
                  {formatSignedAmount(entry.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ReceivedStarItem = {
  id: string;
  actorAvatarUrl: string | null;
  actorLogin: string;
  repositoryName: string;
  starredAt: string;
};

function getReceivedStars(repositories: GithubRepository[]): ReceivedStarItem[] {
  return repositories
    .flatMap((repository) => {
      const submitted = repository.submittedRepository;
      if (!submitted) {
        return [];
      }

      const repositoryName = `${repository.githubOwner}/${repository.githubRepo}`;
      return submitted.recentStars.map((star) => ({
        id: `${submitted.id}:${star.id}`,
        actorAvatarUrl: star.actor.avatarUrl,
        actorLogin: star.actor.githubLogin,
        repositoryName,
        starredAt: star.starredAt,
      }));
    })
    .sort(
      (left, right) =>
        Date.parse(right.starredAt) - Date.parse(left.starredAt),
    );
}

function StarsReceivedList({
  language,
  receivedStars,
}: {
  language: Language;
  receivedStars: ReceivedStarItem[];
}) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-4 py-3">
        <div className="flex items-center gap-2 text-on-surface">
          <Star className="text-primary" size={18} fill="currentColor" />
          <h3 className="text-lg font-semibold">
            {label(language, 'Stars Received', '收到的 Star')}
          </h3>
        </div>
        <span className="mono text-on-surface-variant">
          {receivedStars.length}
        </span>
      </div>

      {receivedStars.length === 0 ? (
        <div className="p-5">
          <p className="text-sm leading-6 text-on-surface-variant">
            {label(
              language,
              'No verified StarBuddy stars have landed on your promoted repositories yet.',
              '你的推广仓库还没有收到通过 StarBuddy 验证的 Star。',
            )}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant">
          {receivedStars.map((star) => (
            <div
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface-container-high"
              key={star.id}
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-variant text-on-surface-variant">
                  {star.actorAvatarUrl ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={star.actorAvatarUrl}
                    />
                  ) : (
                    <Github size={16} />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="mono block truncate text-on-surface">
                    @{star.actorLogin}
                  </span>
                  <span className="block truncate text-xs text-on-surface-variant">
                    {label(language, 'starred', '给')}{' '}
                    <span className="text-primary">{star.repositoryName}</span>
                    {language === 'zh' ? ' 点了 Star' : ''}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-on-surface-variant">
                  {formatRelativeTime(language, star.starredAt)}
                </span>
                <span className="inline-flex items-center rounded-full border border-tertiary/20 bg-tertiary/10 px-2 py-0.5 text-[10px] font-medium text-tertiary">
                  {label(language, 'Verified', '已验证')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LedgerStatusBadge({
  entry,
  language,
}: {
  entry: CreditLedgerEntry;
  language: Language;
}) {
  const positive = entry.amount > 0;
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-2 rounded-full border px-2 text-xs font-medium ${
        positive
          ? 'border-tertiary/30 bg-tertiary/10 text-tertiary'
          : 'border-primary/30 bg-primary/10 text-primary'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${positive ? 'bg-tertiary' : 'bg-primary'}`} />
      {positive
        ? label(language, 'Confirmed', '已确认')
        : label(language, 'Exchanged', '已兑换')}
    </span>
  );
}

function LifetimeImpactCard({
  language,
  value,
}: {
  language: Language;
  value: number;
}) {
  return (
    <section className="surface-panel flex flex-col items-center p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary-container/20 text-primary">
        <Star size={30} fill="currentColor" />
      </div>
      <h3 className="text-lg font-semibold text-on-surface">
        {label(language, 'Lifetime Impact', '长期影响力')}
      </h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        {label(
          language,
          'Total effective exchanges across the network.',
          '你在网络中的有效贡献与兑换总量。',
        )}
      </p>
      <strong className="mono mt-5 text-4xl text-primary">{value}</strong>
    </section>
  );
}

function ExchangeRatioCard({
  language,
  starsGiven,
  starsReceived,
}: {
  language: Language;
  starsGiven: number;
  starsReceived: number;
}) {
  const maxValue = Math.max(starsGiven, starsReceived, 1);

  return (
    <section className="surface-panel p-4">
      <h4 className="label-caps mb-4 text-on-surface-variant">
        {label(language, 'Exchange Ratio', '交换比例')}
      </h4>
      <div className="space-y-4">
        <RatioBar
          icon={<ArrowUp size={16} />}
          label={label(language, 'Stars Given', '给出的 Star')}
          tone="bg-tertiary text-tertiary"
          value={starsGiven}
          width={(starsGiven / maxValue) * 100}
        />
        <RatioBar
          icon={<ArrowDown size={16} />}
          label={label(language, 'Stars Received', '收到的 Star')}
          tone="bg-primary text-primary"
          value={starsReceived}
          width={(starsReceived / maxValue) * 100}
        />
      </div>
    </section>
  );
}

function RatioBar({
  icon,
  label: ratioLabel,
  tone,
  value,
  width,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  value: number;
  width: number;
}) {
  const [barTone, textTone] = tone.split(' ');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={`flex items-center gap-2 text-sm text-on-surface ${textTone}`}>
          {icon}
          {ratioLabel}
        </span>
        <span className="mono text-on-surface">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-variant">
        <div
          className={`h-full rounded-full ${barTone}`}
          style={{ width: `${Math.max(4, width)}%` }}
        />
      </div>
    </div>
  );
}

function AvailableCreditsCard({
  availableCredits,
  earned,
  language,
  spent,
  t,
}: {
  availableCredits: number;
  earned: number;
  language: Language;
  spent: number;
  t: Translator;
}) {
  return (
    <section className="surface-panel relative overflow-hidden bg-surface-bright p-4">
      <div className="pointer-events-none absolute -right-8 -top-8 text-secondary opacity-10">
        <WalletCards size={112} />
      </div>
      <h4 className="label-caps text-on-surface-variant">
        {label(language, 'Available Credits', '可用积分')}
      </h4>
      <div className="relative mt-3 flex items-center gap-3">
        <WalletCards className="text-secondary" size={22} />
        <span className="mono text-3xl text-on-surface">{availableCredits}</span>
        <span className="text-sm text-on-surface-variant">{t('creditUnit')}</span>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-4">
        <div>
          <p className="label-caps text-on-surface-variant">
            {label(language, 'Earned', '已赚取')}
          </p>
          <span className="mono mt-1 block text-tertiary">+{earned}</span>
        </div>
        <div>
          <p className="label-caps text-on-surface-variant">
            {label(language, 'Spent', '已消耗')}
          </p>
          <span className="mono mt-1 block text-primary">-{spent}</span>
        </div>
      </div>
    </section>
  );
}

function formatSignedAmount(amount: number) {
  return `${amount > 0 ? '+' : ''}${amount}`;
}

function ledgerAmountClass(amount: number) {
  if (amount > 0) {
    return 'text-tertiary';
  }

  if (amount < 0) {
    return 'text-primary';
  }

  return 'text-on-surface-variant';
}

function TaskPanel({
  language,
  loading,
  task,
  t,
  onRefresh,
  onReport,
  onStar,
}: {
  language: Language;
  loading: boolean;
  task: CurrentTask | EmptyTask | null;
  t: Translator;
  onRefresh: () => void;
  onReport: (repositoryId: string) => void;
  onStar: (claimId: string) => void;
}) {
  if (!task) {
    return (
      <EmptyBlock
        action={
          <button className="primary-button" disabled={loading} onClick={onRefresh}>
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            {t('loadRecommendation')}
          </button>
        }
        icon={<Star size={32} />}
        title={t('projectQueueReady')}
        description={t('projectQueueReadyHelp')}
      />
    );
  }

  if (task.status !== 'available') {
    const copy = emptyTaskCopy(language, task.status, t);
    return (
      <EmptyBlock
        action={
          <button className="secondary-button" disabled={loading} onClick={onRefresh}>
            <RefreshCw size={17} />
            {t('refresh')}
          </button>
        }
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
      />
    );
  }

  const githubUrl = `https://github.com/${task.repository.owner}/${task.repository.repo}`;

  return (
    <section className="surface-panel-low relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-primary-container opacity-[0.03]" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 border-b border-outline-variant pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high text-primary">
              <Star size={24} />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="status-badge border-primary/30 bg-primary/10 text-primary">
                  Active Claim
                </span>
                <span className="mono flex items-center gap-1 text-error">
                  <Clock3 size={14} />
                  {new Date(task.expiresAt).toLocaleTimeString(
                    language === 'zh' ? 'zh-CN' : 'en-US',
                  )}
                </span>
              </div>
              <h2 className="mono text-xl text-on-surface">
                {task.repository.fullName}
              </h2>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              className="secondary-button"
              href={githubUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Github size={17} />
              {label(language, 'Go to Repo', '前往仓库')}
            </a>
            <button
              className="primary-button bg-tertiary text-on-tertiary"
              disabled={loading}
              onClick={() => onStar(task.claimId)}
            >
              {loading ? <Loader2 className="spin" size={17} /> : <BadgeCheck size={17} />}
              {t('starThisProject')}
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <p className="max-w-3xl text-base leading-7 text-on-surface-variant">
              {task.repository.description ?? t('descriptionFallback')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <StatPill icon={<Star size={15} />} value={`${task.repository.starsCountSnapshot}`} label={t('stars')} />
              <StatPill icon={<WalletCards size={15} />} value={`+${task.rewardCredits}`} label={t('creditUnit')} />
            </div>
          </div>
          <div className="surface-panel bg-surface-container-high p-4">
            <p className="label-caps text-on-surface-variant">
              {label(language, 'Task Guidance', '任务说明')}
            </p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {label(
                language,
                'Open the repository, review it deliberately, then complete the star action through StarBuddy.',
                '打开仓库，认真查看后，通过 StarBuddy 完成 Star 操作。',
              )}
            </p>
            <button
              className="ghost-button mt-4 w-full"
              disabled={loading}
              onClick={() => onReport(task.repository.id)}
            >
              <Flag size={16} />
              {t('reportProject')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactTaskSummary({
  language,
  loading,
  task,
  t,
  onGoTasks,
  onRefresh,
}: {
  language: Language;
  loading: boolean;
  task: CurrentTask | EmptyTask | null;
  t: Translator;
  onGoTasks: () => void;
  onRefresh: () => void;
}) {
  if (!task || task.status !== 'available') {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-4">
        <p className="text-sm text-on-surface-variant">
          {!task ? t('projectQueueReadyHelp') : emptyTaskCopy(language, task.status, t).description}
        </p>
        <button className="secondary-button mt-4" disabled={loading} onClick={onRefresh}>
          <RefreshCw size={16} />
          {t('refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mono text-lg text-on-surface">{task.repository.fullName}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">
          {task.repository.description ?? t('descriptionFallback')}
        </p>
      </div>
      <button className="primary-button" onClick={onGoTasks}>
        <ArrowRight size={16} />
        {label(language, 'Open Task', '打开任务')}
      </button>
    </div>
  );
}

function RepositoryRow({
  canSwitch,
  language,
  loading,
  repository,
  t,
  onActivate,
  onPause,
  onResume,
  onSubmit,
}: {
  canSwitch: boolean;
  language: Language;
  loading: boolean;
  repository: GithubRepository;
  t: Translator;
  onActivate: (repositoryId: string) => void;
  onPause: (repositoryId: string) => void;
  onResume: (repositoryId: string) => void;
  onSubmit: (githubRepoId: string) => void;
}) {
  const submitted = repository.submittedRepository;
  const description =
    submitted?.description ?? repository.description ?? t('descriptionFallback');
  const starsCount = submitted?.starsCountSnapshot ?? repository.starsCountSnapshot;

  return (
    <article className="surface-panel-low p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="mono truncate text-lg text-on-surface">
              {repository.githubOwner}/{repository.githubRepo}
            </h3>
            {submitted ? (
              <RepositoryStatusBadge language={language} status={submitted.status} />
            ) : (
              <span className="status-badge border-outline-variant bg-surface-container text-on-surface-variant">
                GitHub
              </span>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            {description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatPill icon={<Star size={15} />} value={String(starsCount)} label={t('stars')} />
            {submitted ? (
              <StatPill
                icon={<BadgeCheck size={15} />}
                value={String(submitted.starBuddyStarsCount)}
                label="StarBuddy"
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          {!submitted ? (
            <button
              className="primary-button"
              disabled={loading}
              onClick={() => onSubmit(repository.githubRepoId)}
            >
              <Plus size={16} />
              {t('submit')}
            </button>
          ) : null}
          {submitted?.status === 'active' ? (
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => onPause(submitted.id)}
            >
              <Pause size={16} />
              {t('pausePromotion')}
            </button>
          ) : null}
          {submitted?.status === 'paused' ? (
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => onResume(submitted.id)}
            >
              <Play size={16} />
              {t('resumePromotion')}
            </button>
          ) : null}
          {submitted?.status === 'inactive' ? (
            <button
              className="primary-button"
              disabled={loading || !canSwitch}
              onClick={() => onActivate(submitted.id)}
            >
              <Star size={16} />
              {t('activatePromotion')}
            </button>
          ) : null}
        </div>
      </div>
      {submitted?.recentStars.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
          <span className="label-caps text-on-surface-variant">
            {t('recentStargazers')}
          </span>
          {submitted.recentStars.map((star) => (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-2 py-1 text-xs text-on-surface"
              key={star.id}
            >
              {star.actor.avatarUrl ? (
                <img alt="" className="h-5 w-5 rounded-full" src={star.actor.avatarUrl} />
              ) : null}
              @{star.actor.githubLogin}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RepositorySummaryCard({
  language,
  repository,
  t,
}: {
  language: Language;
  repository: GithubRepository;
  t: Translator;
}) {
  const submitted = repository.submittedRepository;
  if (!submitted) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="mono truncate text-lg text-on-surface">
          {repository.githubOwner}/{repository.githubRepo}
        </h3>
        <RepositoryStatusBadge language={language} status={submitted.status} />
      </div>
      <p className="text-sm leading-6 text-on-surface-variant">
        {submitted.description ?? repository.description ?? t('descriptionFallback')}
      </p>
      <div className="flex flex-wrap gap-3">
        <StatPill
          icon={<Star size={15} />}
          value={String(submitted.starsCountSnapshot)}
          label={t('stars')}
        />
        <StatPill
          icon={<BadgeCheck size={15} />}
          value={String(submitted.starBuddyStarsCount)}
          label="StarBuddy"
        />
      </div>
    </div>
  );
}

function LedgerList({
  language,
  ledger,
  t,
}: {
  language: Language;
  ledger: CreditLedgerEntry[];
  t: Translator;
}) {
  if (ledger.length === 0) {
    return (
      <div className="p-5">
        <p className="text-sm text-on-surface-variant">{t('noCreditActivity')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-outline-variant">
      {ledger.map((entry) => (
        <div
          className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
          key={entry.id}
        >
          <div>
            <strong className="text-sm text-on-surface">
              {formatLedgerReason(language, entry.reason)}
            </strong>
            <p className="mono mt-1 text-on-surface-variant">
              {new Date(entry.createdAt).toLocaleString(
                language === 'zh' ? 'zh-CN' : 'en-US',
              )}
            </p>
          </div>
          <span className="mono text-on-surface-variant">
            {entry.relatedEntityType ?? label(language, 'Account', '账户')}
          </span>
          <span
            className={`mono text-lg ${entry.amount >= 0 ? 'text-tertiary' : 'text-error'}`}
          >
            {entry.amount > 0 ? '+' : ''}
            {entry.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

function PageHeader({
  description,
  eyebrow,
  right,
  title,
}: {
  description?: string;
  eyebrow: string;
  right?: React.ReactNode;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-outline-variant pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="label-caps mb-2 text-primary">{eyebrow}</p>
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-on-surface md:text-[32px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-base leading-7 text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-on-surface">
      <span className="text-primary">{icon}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  );
}

function MetricBlock({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <div className="surface-panel bg-surface-container p-4">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high ${tone}`}>
        {icon}
      </div>
      <p className="text-sm text-on-surface-variant">{label}</p>
      <strong className="mt-1 block font-mono text-3xl font-semibold tabular-nums tracking-tight text-on-surface">
        {value}
      </strong>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface-variant">
      {icon}
      <strong className="mono text-on-surface">{value}</strong>
      {label}
    </span>
  );
}

function RepositoryStatusBadge({
  language,
  status,
}: {
  language: Language;
  status: string;
}) {
  const active = status === 'active';
  const paused = status.startsWith('paused');
  return (
    <span
      className={`status-badge ${
        active
          ? 'border-primary/30 bg-primary/10 text-primary'
          : paused
            ? 'border-secondary/30 bg-secondary/10 text-secondary'
            : 'border-outline-variant bg-surface-container text-on-surface-variant'
      }`}
    >
      {active ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
      {formatStatus(language, status)}
    </span>
  );
}

function EmptyBlock({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="surface-panel-low grid min-h-80 place-items-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high text-primary">
          {icon}
        </div>
        <h2 className="text-2xl font-semibold text-on-surface">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </section>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div className="surface-panel-low flex min-h-40 items-center justify-center gap-3 p-5 text-on-surface-variant">
      <Loader2 className="spin" size={20} />
      <span>{text}</span>
    </div>
  );
}

function FlashMessages({ error, message }: { error: string; message: string }) {
  if (!error && !message) {
    return null;
  }

  return (
    <div className="space-y-2">
      {message ? (
        <div className="rounded-lg border border-tertiary/30 bg-tertiary/10 px-4 py-3 text-sm text-tertiary">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}
    </div>
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
    <div
      className="inline-flex h-10 overflow-hidden rounded-md border border-outline-variant bg-surface-container"
      aria-label="Language"
    >
      <div className="hidden w-9 items-center justify-center border-r border-outline-variant text-on-surface-variant sm:flex">
        <Languages size={16} />
      </div>
      {(['en', 'zh'] as const).map((option) => (
        <button
          className={`min-w-11 px-2 text-xs font-bold transition ${
            language === option
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          }`}
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

function emptyTaskCopy(
  language: Language,
  status: EmptyTask['status'],
  t: Translator,
) {
  if (status === 'tasks_disabled') {
    return {
      description: t('noProjectsAvailableHelp'),
      icon: <Shield size={30} />,
      title: t('tasksDisabled'),
    };
  }
  if (status === 'account_suspended') {
    return {
      description: t('noProjectsAvailableHelp'),
      icon: <Shield size={30} />,
      title: t('userSuspended'),
    };
  }
  if (status === 'daily_user_limit_reached') {
    return {
      description: label(
        language,
        'Your daily task limit is complete. Check back after the next reset.',
        '你的每日任务上限已完成，请在下次刷新后回来。',
      ),
      icon: <Clock3 size={30} />,
      title: t('dailyLimitReached'),
    };
  }
  return {
    description: t('noProjectsAvailableHelp'),
    icon: <BookOpen size={30} />,
    title: t('noProjectsAvailable'),
  };
}

function readHashView(): View {
  const hash = window.location.hash.replace('#', '');
  return views.some((view) => view.id === hash) ? (hash as View) : 'dashboard';
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

function formatRelativeTime(language: Language, value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (elapsedSeconds < minute) {
    return label(language, 'Just now', '刚刚');
  }

  if (elapsedSeconds < hour) {
    const minutes = Math.floor(elapsedSeconds / minute);
    return language === 'zh' ? `${minutes} 分钟前` : `${minutes} min ago`;
  }

  if (elapsedSeconds < day) {
    const hours = Math.floor(elapsedSeconds / hour);
    return language === 'zh' ? `${hours} 小时前` : `${hours} hours ago`;
  }

  if (elapsedSeconds < day * 2) {
    return label(language, 'Yesterday', '昨天');
  }

  return new Date(timestamp).toLocaleDateString(
    language === 'zh' ? 'zh-CN' : 'en-US',
  );
}

function label(language: Language, english: string, chinese: string) {
  return language === 'zh' ? chinese : english;
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
