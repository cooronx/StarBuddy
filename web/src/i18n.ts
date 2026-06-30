export type Language = 'en' | 'zh';

export const LANGUAGE_STORAGE_KEY = 'starbuddy_language';

type TranslationKey =
  | 'addRepository'
  | 'admin'
  | 'adminCleanup'
  | 'adminCleanupComplete'
  | 'adminReports'
  | 'adminSystem'
  | 'alreadyStarredNoReward'
  | 'activatePromotion'
  | 'activePromotion'
  | 'archiveRepository'
  | 'dailyLimitReached'
  | 'claimExpires'
  | 'continue'
  | 'continueWithGithub'
  | 'credits'
  | 'creditUnit'
  | 'descriptionFallback'
  | 'errorFallback'
  | 'githubOAuthHelp'
  | 'introCopy'
  | 'introHeadline'
  | 'languageEnglish'
  | 'languageChinese'
  | 'loadRecommendation'
  | 'loginComplete'
  | 'loadingProjects'
  | 'inactivePromotion'
  | 'noCreditActivity'
  | 'noProjectsAvailable'
  | 'noProjectsAvailableHelp'
  | 'noPublicRepositories'
  | 'noReports'
  | 'noStarBuddyStars'
  | 'oauthAccessDenied'
  | 'oauthFailed'
  | 'oauthInsufficientScope'
  | 'oauthStateMismatch'
  | 'pausePromotion'
  | 'pausedPromotion'
  | 'permissionProfile'
  | 'permissionRepositories'
  | 'permissionStar'
  | 'promotionActivated'
  | 'promotionPaused'
  | 'promotionResumed'
  | 'projectAdded'
  | 'projectQueueReady'
  | 'projectQueueReadyHelp'
  | 'recommendedProject'
  | 'rejectRepository'
  | 'reportProject'
  | 'repositoryReported'
  | 'refresh'
  | 'refreshingProjects'
  | 'repositoryNoCredits'
  | 'restoreRepository'
  | 'recentStargazers'
  | 'resumePromotion'
  | 'signOut'
  | 'skip'
  | 'skippedLoading'
  | 'suspendReporter'
  | 'starCompletedRewarded'
  | 'starBuddyStars'
  | 'starThisProject'
  | 'stars'
  | 'submit'
  | 'submitted'
  | 'submittedCount'
  | 'switchResetCountdown'
  | 'tagline'
  | 'tasksDisabled'
  | 'userSuspended'
  | 'yourProjects';

type TemplateValues = Record<string, string | number>;

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    addRepository: 'Add your repository',
    admin: 'Admin',
    adminCleanup: 'Run cleanup',
    adminCleanupComplete:
      'Cleanup removed {oauthLoginCodes} login codes, {rateLimitEvents} rate-limit events, {taskClaims} claims, and {repositoryReports} reports.',
    adminReports: 'Reports',
    adminSystem: 'System',
    alreadyStarredNoReward: '{repository} was already starred. No credits changed.',
    activatePromotion: 'Set active',
    activePromotion: '推广中',
    archiveRepository: 'Archive',
    dailyLimitReached: 'Daily limit reached. Try again after the next server-local day starts.',
    claimExpires: 'claim expires',
    continue: 'Continue',
    continueWithGithub: 'Continue with GitHub',
    credits: 'Credits',
    creditUnit: 'credit',
    descriptionFallback: 'No repository description provided.',
    errorFallback: 'Something went wrong',
    githubOAuthHelp:
      'Authorize StarBuddy to read your GitHub profile and star public repositories when you run tasks.',
    introCopy:
      'Join with GitHub, submit one active public repository, and review other open source projects to earn credits.',
    introHeadline: 'Open source discovery with a fair credit queue.',
    languageEnglish: 'EN',
    languageChinese: '中文',
    loadRecommendation: 'Load recommendation',
    loginComplete: 'GitHub authorization complete. Loading your queue.',
    loadingProjects: 'Loading projects...',
    inactivePromotion: '未激活',
    noCreditActivity: 'No credit activity yet.',
    noProjectsAvailable: 'No projects available',
    noProjectsAvailableHelp: 'Submit your own repository or refresh after more users join.',
    noPublicRepositories: 'No public GitHub repositories found.',
    noReports: 'No reports yet.',
    noStarBuddyStars: 'No StarBuddy stars yet.',
    oauthAccessDenied: 'GitHub authorization was cancelled.',
    oauthFailed: 'GitHub authorization failed. Try again.',
    oauthInsufficientScope:
      'StarBuddy needs read:user and public_repo permissions to continue.',
    oauthStateMismatch: 'Authorization session expired. Try again.',
    pausePromotion: 'Pause',
    pausedPromotion: '已暂停',
    permissionProfile: 'Read your GitHub profile',
    permissionRepositories: 'Read your public repositories',
    permissionStar: 'Star public repositories when you run a task',
    promotionActivated: '{repository} is now active.',
    promotionPaused: '{repository} paused.',
    promotionResumed: '{repository} resumed.',
    projectAdded: '{repository} added.',
    projectQueueReady: 'Your project queue is ready.',
    projectQueueReadyHelp: 'Load the first recommendation and decide whether to star it.',
    recommendedProject: 'Recommended project',
    rejectRepository: 'Reject',
    reportProject: 'Report',
    repositoryReported: 'Report submitted.',
    refresh: 'Refresh',
    refreshingProjects: 'Refreshing projects...',
    repositoryNoCredits: '{repository} was starred, but the owner had no credits left.',
    restoreRepository: 'Restore',
    recentStargazers: 'Recent stargazers',
    resumePromotion: 'Resume',
    signOut: 'Sign out',
    skip: 'Skip',
    skippedLoading: 'Skipped. Loading another project.',
    suspendReporter: 'Suspend reporter',
    starCompletedRewarded: 'Starred {repository}. You earned 1 credit.',
    starBuddyStars: '{count} StarBuddy stars',
    starThisProject: 'Star this project',
    stars: 'stars',
    submit: 'Submit',
    submitted: 'Submitted',
    submittedCount: '{submitted}/{total} submitted to StarBuddy.',
    switchResetCountdown: 'Switch available in {time}.',
    tagline: 'Discover projects, star deliberately, earn credits.',
    tasksDisabled: 'Star tasks are temporarily disabled.',
    userSuspended: 'This account is suspended.',
    yourProjects: 'Your projects',
  },
  zh: {
    addRepository: '添加你的仓库',
    admin: '管理',
    adminCleanup: '执行清理',
    adminCleanupComplete:
      '已清理 {oauthLoginCodes} 条登录码、{rateLimitEvents} 条限流记录、{taskClaims} 条任务记录、{repositoryReports} 条举报记录。',
    adminReports: '举报',
    adminSystem: '系统状态',
    alreadyStarredNoReward: '{repository} 已经 Star 过，积分未变化。',
    activatePromotion: '设为 Active',
    activePromotion: 'Active',
    archiveRepository: '归档',
    dailyLimitReached: '今日上限已达到，请等服务器本地自然日刷新后再试。',
    claimExpires: '任务过期时间',
    continue: '继续',
    continueWithGithub: '使用 GitHub 继续',
    credits: '积分',
    creditUnit: '积分',
    descriptionFallback: '这个仓库没有提供描述。',
    errorFallback: '出错了',
    githubOAuthHelp:
      '授权 StarBuddy 读取你的 GitHub 资料，并在你执行任务时为公开仓库 Star。',
    introCopy:
      '使用 GitHub 加入，提交一个 active 公开仓库，然后通过认真查看其他开源项目来赚取积分。',
    introHeadline: '带公平积分队列的开源项目发现工具。',
    languageEnglish: 'EN',
    languageChinese: '中文',
    loadRecommendation: '加载推荐项目',
    loginComplete: 'GitHub 授权完成，正在加载你的队列。',
    loadingProjects: '正在加载项目...',
    inactivePromotion: 'Inactive',
    noCreditActivity: '暂无积分记录。',
    noProjectsAvailable: '暂无可推荐项目',
    noProjectsAvailableHelp: '提交你自己的仓库，或等更多用户加入后再刷新。',
    noPublicRepositories: '没有找到公开 GitHub 仓库。',
    noReports: '暂无举报。',
    noStarBuddyStars: '还没有通过 StarBuddy 收获 Star。',
    oauthAccessDenied: 'GitHub 授权已取消。',
    oauthFailed: 'GitHub 授权失败，请重试。',
    oauthInsufficientScope: 'StarBuddy 需要 read:user 和 public_repo 权限才能继续。',
    oauthStateMismatch: '授权会话已过期，请重试。',
    pausePromotion: '暂停',
    pausedPromotion: 'Paused',
    permissionProfile: '读取你的 GitHub 资料',
    permissionRepositories: '读取你的公开仓库',
    permissionStar: '在你执行任务时为公开仓库 Star',
    promotionActivated: '{repository} 已设为 Active。',
    promotionPaused: '{repository} 已暂停。',
    promotionResumed: '{repository} 已恢复。',
    projectAdded: '{repository} 已添加。',
    projectQueueReady: '你的项目队列已就绪。',
    projectQueueReadyHelp: '加载第一个推荐项目，然后决定是否 Star。',
    recommendedProject: '推荐项目',
    rejectRepository: '拒绝',
    reportProject: '举报',
    repositoryReported: '已提交举报。',
    refresh: '刷新',
    refreshingProjects: '正在刷新项目...',
    repositoryNoCredits: '{repository} 已 Star，但仓库所有者积分不足。',
    restoreRepository: '恢复',
    recentStargazers: '最近点 Star 的用户',
    resumePromotion: '恢复',
    signOut: '退出登录',
    skip: '跳过',
    skippedLoading: '已跳过，正在加载下一个项目。',
    suspendReporter: '暂停举报者账号',
    starCompletedRewarded: '已 Star {repository}，你获得了 1 积分。',
    starBuddyStars: 'StarBuddy 收获 {count} 个 Star',
    starThisProject: '给这个项目 Star',
    stars: 'stars',
    submit: '提交',
    submitted: '已提交',
    submittedCount: '{submitted}/{total} 个已提交到 StarBuddy。',
    switchResetCountdown: '{time} 后可再次切换。',
    tagline: '发现项目，认真 Star，赚取积分。',
    tasksDisabled: 'Star 任务暂时关闭。',
    userSuspended: '这个账号已暂停。',
    yourProjects: '你的项目',
  },
};

const statusLabels: Record<Language, Record<string, string>> = {
  en: {
    active: 'Active',
    inactive: 'Inactive',
    paused: 'Paused',
    archived: 'Archived',
    rejected: 'Rejected',
    paused_insufficient_credits: 'Paused: insufficient credits',
    paused_by_owner: 'Paused by owner',
    disabled: 'Disabled',
    claimed: 'Claimed',
    completed_rewarded: 'Completed',
    completed_no_reward: 'Completed, no reward',
    failed: 'Failed',
    cancelled_insufficient_credits: 'Cancelled: insufficient credits',
    cancelled_daily_limit: 'Cancelled: daily limit reached',
    cancelled_repository_unavailable: 'Cancelled: repository unavailable',
    skipped: 'Skipped',
    expired: 'Expired',
    already_starred_no_reward: 'Already starred',
    already_completed: 'Already completed',
    completed_unrewarded_insufficient_credits: 'Completed, owner out of credits',
    tasks_disabled: 'Tasks disabled',
    account_suspended: 'Account suspended',
    daily_user_limit_reached: 'Daily user limit reached',
    daily_repository_limit_reached: 'Daily repository limit reached',
  },
  zh: {
    active: '进行中',
    inactive: '未激活',
    paused: '已暂停',
    archived: '已归档',
    rejected: '已拒绝',
    paused_insufficient_credits: '已暂停：积分不足',
    paused_by_owner: '所有者已暂停',
    disabled: '已停用',
    claimed: '已领取',
    completed_rewarded: '已完成',
    completed_no_reward: '已完成，无奖励',
    failed: '失败',
    cancelled_insufficient_credits: '已取消：积分不足',
    cancelled_daily_limit: '已取消：达到今日上限',
    cancelled_repository_unavailable: '已取消：仓库不可用',
    skipped: '已跳过',
    expired: '已过期',
    already_starred_no_reward: '已 Star',
    already_completed: '已结算',
    completed_unrewarded_insufficient_credits: '已完成，所有者积分不足',
    tasks_disabled: '任务已关闭',
    account_suspended: '账号已暂停',
    daily_user_limit_reached: '用户今日上限已达到',
    daily_repository_limit_reached: '仓库今日上限已达到',
  },
};

const ledgerReasonLabels: Record<Language, Record<string, string>> = {
  en: {
    signup_bonus: 'Signup bonus',
    star_completed_reward: 'Star completed reward',
    repository_star_spend: 'Repository star spend',
  },
  zh: {
    signup_bonus: '注册奖励',
    star_completed_reward: '完成 Star 奖励',
    repository_star_spend: '仓库 Star 消耗',
  },
};

export function getInitialLanguage(): Language {
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === 'en' || savedLanguage === 'zh') {
    return savedLanguage;
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function translate(
  language: Language,
  key: TranslationKey,
  values: TemplateValues = {},
) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    translations[language][key],
  );
}

export function formatStatus(language: Language, status: string) {
  return statusLabels[language][status] ?? fallbackLabel(status);
}

export function formatLedgerReason(language: Language, reason: string) {
  return ledgerReasonLabels[language][reason] ?? fallbackLabel(reason);
}

function fallbackLabel(value: string) {
  return value.replaceAll('_', ' ');
}
