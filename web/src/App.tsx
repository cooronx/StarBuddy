import { FormEvent, useCallback, useMemo, useState } from 'react';
import {
  ArrowRight,
  Github,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Star,
  WalletCards,
  X,
} from 'lucide-react';
import {
  ApiClient,
  CreditLedgerEntry,
  CurrentTask,
  EmptyTask,
  Repository,
  TaskResult,
  User,
} from './api';

const ACCESS_TOKEN_KEY = 'starbuddy_access_token';

export function App() {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const [user, setUser] = useState<User | null>(null);
  const [currentTask, setCurrentTask] = useState<CurrentTask | EmptyTask | null>(
    null,
  );
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => new ApiClient(() => accessToken), [accessToken]);

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
        api.listRepositories(),
      ]);

      setUser(me);
      setCurrentTask(task);
      setLedger(history);
      setRepositories(mine);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, api]);

  async function handleLogin(token: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.bindGithubToken(token);
      localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
      setAccessToken(response.accessToken);
      setUser(response.user);
      setMessage('GitHub token bound. Loading your queue.');
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setLoading(false);
    }
  }

  async function handleRepositorySubmit(url: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const repository = await api.createRepository(url);
      setRepositories((items) => [repository, ...items]);
      setMessage(`${repository.githubOwner}/${repository.githubRepo} added.`);
    } catch (repositoryError) {
      setError(errorMessage(repositoryError));
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
      setMessage(resultMessage(result));
      await refresh();
    } catch (starError) {
      setError(errorMessage(starError));
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
      setMessage('Skipped. Loading another project.');
      const task = await api.getCurrentTask();
      setCurrentTask(task);
    } catch (skipError) {
      setError(errorMessage(skipError));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
    setCurrentTask(null);
    setLedger([]);
    setRepositories([]);
    setMessage('');
    setError('');
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
            <p>Discover projects, star deliberately, earn credits.</p>
          </div>
        </div>

        {user ? (
          <div className="profile">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
            <div>
              <strong>{user.githubLogin}</strong>
              <span>{user.creditsBalance} credits</span>
            </div>
            <button className="icon-button" onClick={refresh} title="Refresh">
              {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
            <button className="ghost-button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!accessToken ? (
        <LoginPanel loading={loading} onLogin={handleLogin} />
      ) : (
        <section className="workspace">
          <aside className="side-panel">
            <RepositoryForm loading={loading} onSubmit={handleRepositorySubmit} />
            <RepositoryList repositories={repositories} />
          </aside>

          <section className="main-panel">
            <TaskCard
              task={currentTask}
              loading={loading}
              onInitialLoad={refresh}
              onStar={handleStar}
              onSkip={handleSkip}
            />
          </section>

          <aside className="side-panel">
            <CreditPanel user={user} ledger={ledger} />
          </aside>
        </section>
      )}
    </main>
  );
}

function LoginPanel({
  loading,
  onLogin,
}: {
  loading: boolean;
  onLogin: (token: string) => void;
}) {
  const [token, setToken] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onLogin(token);
  }

  return (
    <section className="login-layout">
      <form className="login-panel" onSubmit={submit}>
        <div className="panel-heading">
          <KeyRound size={22} />
          <div>
            <h2>Bind GitHub token</h2>
            <p>Use a fine-grained PAT with Starring write and Metadata read.</p>
          </div>
        </div>
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="github_pat_..."
          type="password"
          autoComplete="off"
        />
        <button className="primary-button" disabled={loading || !token}>
          {loading ? <Loader2 className="spin" size={18} /> : <Github size={18} />}
          Continue
        </button>
      </form>
    </section>
  );
}

function RepositoryForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
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
        <h2>Add your repository</h2>
      </div>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://github.com/owner/repo"
      />
      <button className="secondary-button" disabled={loading || !url}>
        <Send size={17} />
        Submit
      </button>
    </form>
  );
}

function RepositoryList({ repositories }: { repositories: Repository[] }) {
  return (
    <section className="tool-panel">
      <div className="panel-title">
        <Github size={18} />
        <h2>Your projects</h2>
      </div>
      <div className="compact-list">
        {repositories.length === 0 ? (
          <p className="muted">No submitted repositories yet.</p>
        ) : (
          repositories.map((repository) => (
            <div className="compact-row" key={repository.id}>
              <strong>
                {repository.githubOwner}/{repository.githubRepo}
              </strong>
              <span>{repository.starTask?.status ?? repository.status}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  loading,
  onInitialLoad,
  onStar,
  onSkip,
}: {
  task: CurrentTask | EmptyTask | null;
  loading: boolean;
  onInitialLoad: () => void;
  onStar: (claimId: string) => void;
  onSkip: (claimId: string) => void;
}) {
  if (!task) {
    return (
      <section className="project-card empty-card">
        <Star size={34} />
        <h2>Your project queue is ready.</h2>
        <p>Load the first recommendation and decide whether to star it.</p>
        <button className="primary-button" disabled={loading} onClick={onInitialLoad}>
          {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          Load recommendation
        </button>
      </section>
    );
  }

  if (task.status === 'no_task_available') {
    return (
      <section className="project-card empty-card">
        <Github size={34} />
        <h2>No projects available</h2>
        <p>Submit your own repository or refresh after more users join.</p>
        <button className="secondary-button" disabled={loading} onClick={onInitialLoad}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>
    );
  }

  return (
    <section className="project-card">
      <div className="project-meta">
        <span>Recommended project</span>
        <span>+{task.rewardCredits} credit</span>
      </div>
      <h2>{task.repository.fullName}</h2>
      <p className="description">
        {task.repository.description ?? 'No repository description provided.'}
      </p>
      <div className="stats-strip">
        <div>
          <strong>{task.repository.starsCountSnapshot}</strong>
          <span>stars</span>
        </div>
        <div>
          <strong>{new Date(task.expiresAt).toLocaleTimeString()}</strong>
          <span>claim expires</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="ghost-action"
          disabled={loading}
          onClick={() => onSkip(task.claimId)}
        >
          <X size={18} />
          Skip
        </button>
        <button
          className="primary-action"
          disabled={loading}
          onClick={() => onStar(task.claimId)}
        >
          {loading ? <Loader2 className="spin" size={20} /> : <Star size={20} />}
          Star this project
        </button>
      </div>
    </section>
  );
}

function CreditPanel({
  user,
  ledger,
}: {
  user: User | null;
  ledger: CreditLedgerEntry[];
}) {
  return (
    <section className="tool-panel">
      <div className="panel-title">
        <WalletCards size={18} />
        <h2>Credits</h2>
      </div>
      <div className="balance">{user?.creditsBalance ?? 0}</div>
      <div className="compact-list">
        {ledger.length === 0 ? (
          <p className="muted">No credit activity yet.</p>
        ) : (
          ledger.slice(0, 8).map((entry) => (
            <div className="compact-row" key={entry.id}>
              <strong className={entry.amount > 0 ? 'positive' : 'negative'}>
                {entry.amount > 0 ? '+' : ''}
                {entry.amount}
              </strong>
              <span>{entry.reason.replaceAll('_', ' ')}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function resultMessage(result: TaskResult) {
  if (result.status === 'completed_rewarded') {
    return `Starred ${result.repository}. You earned 1 credit.`;
  }
  if (result.status === 'already_starred_no_reward') {
    return `${result.repository} was already starred. No credits changed.`;
  }
  if (result.status === 'completed_unrewarded_insufficient_credits') {
    return `${result.repository} was starred, but the owner had no credits left.`;
  }
  return result.status.replaceAll('_', ' ');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}
