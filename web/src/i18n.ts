export type Language = 'en' | 'zh';

export const LANGUAGE_STORAGE_KEY = 'starbuddy_language';

type TranslationKey =
  | 'addRepository'
  | 'alreadyStarredNoReward'
  | 'claimExpires'
  | 'continue'
  | 'continueWithGithub'
  | 'credits'
  | 'creditUnit'
  | 'descriptionFallback'
  | 'errorFallback'
  | 'githubOAuthHelp'
  | 'languageEnglish'
  | 'languageChinese'
  | 'loadRecommendation'
  | 'loginComplete'
  | 'loadingProjects'
  | 'noCreditActivity'
  | 'noProjectsAvailable'
  | 'noProjectsAvailableHelp'
  | 'noPublicRepositories'
  | 'oauthAccessDenied'
  | 'oauthFailed'
  | 'oauthInsufficientScope'
  | 'oauthStateMismatch'
  | 'projectAdded'
  | 'projectQueueReady'
  | 'projectQueueReadyHelp'
  | 'recommendedProject'
  | 'refresh'
  | 'refreshingProjects'
  | 'repositoryNoCredits'
  | 'signOut'
  | 'skip'
  | 'skippedLoading'
  | 'starCompletedRewarded'
  | 'starThisProject'
  | 'stars'
  | 'submit'
  | 'submitted'
  | 'submittedCount'
  | 'tagline'
  | 'yourProjects';

type TemplateValues = Record<string, string | number>;

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    addRepository: 'Add your repository',
    alreadyStarredNoReward: '{repository} was already starred. No credits changed.',
    claimExpires: 'claim expires',
    continue: 'Continue',
    continueWithGithub: 'Continue with GitHub',
    credits: 'Credits',
    creditUnit: 'credit',
    descriptionFallback: 'No repository description provided.',
    errorFallback: 'Something went wrong',
    githubOAuthHelp:
      'Authorize StarBuddy to read your GitHub profile and star public repositories when you run tasks.',
    languageEnglish: 'EN',
    languageChinese: '中文',
    loadRecommendation: 'Load recommendation',
    loginComplete: 'GitHub authorization complete. Loading your queue.',
    loadingProjects: 'Loading projects...',
    noCreditActivity: 'No credit activity yet.',
    noProjectsAvailable: 'No projects available',
    noProjectsAvailableHelp: 'Submit your own repository or refresh after more users join.',
    noPublicRepositories: 'No public GitHub repositories found.',
    oauthAccessDenied: 'GitHub authorization was cancelled.',
    oauthFailed: 'GitHub authorization failed. Try again.',
    oauthInsufficientScope:
      'StarBuddy needs read:user and public_repo permissions to continue.',
    oauthStateMismatch: 'Authorization session expired. Try again.',
    projectAdded: '{repository} added.',
    projectQueueReady: 'Your project queue is ready.',
    projectQueueReadyHelp: 'Load the first recommendation and decide whether to star it.',
    recommendedProject: 'Recommended project',
    refresh: 'Refresh',
    refreshingProjects: 'Refreshing projects...',
    repositoryNoCredits: '{repository} was starred, but the owner had no credits left.',
    signOut: 'Sign out',
    skip: 'Skip',
    skippedLoading: 'Skipped. Loading another project.',
    starCompletedRewarded: 'Starred {repository}. You earned 1 credit.',
    starThisProject: 'Star this project',
    stars: 'stars',
    submit: 'Submit',
    submitted: 'Submitted',
    submittedCount: '{submitted}/{total} submitted to StarBuddy.',
    tagline: 'Discover projects, star deliberately, earn credits.',
    yourProjects: 'Your projects',
  },
  zh: {
    addRepository: '添加你的仓库',
    alreadyStarredNoReward: '{repository} 已经 Star 过，积分未变化。',
    claimExpires: '任务过期时间',
    continue: '继续',
    continueWithGithub: '使用 GitHub 继续',
    credits: '积分',
    creditUnit: '积分',
    descriptionFallback: '这个仓库没有提供描述。',
    errorFallback: '出错了',
    githubOAuthHelp:
      '授权 StarBuddy 读取你的 GitHub 资料，并在你执行任务时为公开仓库 Star。',
    languageEnglish: 'EN',
    languageChinese: '中文',
    loadRecommendation: '加载推荐项目',
    loginComplete: 'GitHub 授权完成，正在加载你的队列。',
    loadingProjects: '正在加载项目...',
    noCreditActivity: '暂无积分记录。',
    noProjectsAvailable: '暂无可推荐项目',
    noProjectsAvailableHelp: '提交你自己的仓库，或等更多用户加入后再刷新。',
    noPublicRepositories: '没有找到公开 GitHub 仓库。',
    oauthAccessDenied: 'GitHub 授权已取消。',
    oauthFailed: 'GitHub 授权失败，请重试。',
    oauthInsufficientScope: 'StarBuddy 需要 read:user 和 public_repo 权限才能继续。',
    oauthStateMismatch: '授权会话已过期，请重试。',
    projectAdded: '{repository} 已添加。',
    projectQueueReady: '你的项目队列已就绪。',
    projectQueueReadyHelp: '加载第一个推荐项目，然后决定是否 Star。',
    recommendedProject: '推荐项目',
    refresh: '刷新',
    refreshingProjects: '正在刷新项目...',
    repositoryNoCredits: '{repository} 已 Star，但仓库所有者积分不足。',
    signOut: '退出登录',
    skip: '跳过',
    skippedLoading: '已跳过，正在加载下一个项目。',
    starCompletedRewarded: '已 Star {repository}，你获得了 1 积分。',
    starThisProject: '给这个项目 Star',
    stars: 'stars',
    submit: '提交',
    submitted: '已提交',
    submittedCount: '{submitted}/{total} 个已提交到 StarBuddy。',
    tagline: '发现项目，认真 Star，赚取积分。',
    yourProjects: '你的项目',
  },
};

const statusLabels: Record<Language, Record<string, string>> = {
  en: {
    active: 'Active',
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
    skipped: 'Skipped',
    expired: 'Expired',
    already_starred_no_reward: 'Already starred',
    completed_unrewarded_insufficient_credits: 'Completed, owner out of credits',
  },
  zh: {
    active: '进行中',
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
    skipped: '已跳过',
    expired: '已过期',
    already_starred_no_reward: '已 Star',
    completed_unrewarded_insufficient_credits: '已完成，所有者积分不足',
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
