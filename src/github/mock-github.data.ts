export interface MockGithubUser {
  githubUserId: string;
  login: string;
  avatarUrl: string;
}

export interface MockGithubRepository {
  githubRepoId: string;
  owner: string;
  repo: string;
  description: string;
  starsCount: number;
  submitted: boolean;
}

export const MOCK_GITHUB_USERS: MockGithubUser[] = [
  {
    githubUserId: '900000001',
    login: 'mock-alice',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  {
    githubUserId: '900000002',
    login: 'mock-bob',
    avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
  },
  {
    githubUserId: '900000003',
    login: 'mock-charlie',
    avatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
  },
  {
    githubUserId: '900000004',
    login: 'mock-diana',
    avatarUrl: 'https://avatars.githubusercontent.com/u/4?v=4',
  },
  {
    githubUserId: '900000005',
    login: 'mock-admin',
    avatarUrl: 'https://avatars.githubusercontent.com/u/5?v=4',
  },
];

export const MOCK_GITHUB_REPOSITORIES: MockGithubRepository[] = [
  repo('900001001', 'mock-alice', 'demo-api', 'Mock API service for testing task rewards.', 128, true),
  repo('900001002', 'mock-alice', 'demo-sdk', 'SDK package used to test inactive promotions.', 64, true),
  repo('900001003', 'mock-alice', 'demo-docs', 'Documentation site with a paused promotion state.', 22, true),
  repo('900001004', 'mock-alice', 'playground', 'Unsubmitted playground repository.', 11, false),
  repo('900001005', 'mock-alice', 'side-project', 'Unsubmitted side project.', 7, false),

  repo('900002001', 'mock-bob', 'demo-ui', 'Mock React UI for repository list testing.', 96, true),
  repo('900002002', 'mock-bob', 'demo-dashboard', 'Dashboard project for active switch testing.', 41, true),
  repo('900002003', 'mock-bob', 'demo-theme', 'Rejected theme repository for admin moderation.', 13, true),
  repo('900002004', 'mock-bob', 'playground', 'Unsubmitted UI playground.', 9, false),
  repo('900002005', 'mock-bob', 'side-project', 'Unsubmitted visual experiment.', 5, false),

  repo('900003001', 'mock-charlie', 'demo-cli', 'Command line utility for task queue testing.', 77, true),
  repo('900003002', 'mock-charlie', 'demo-worker', 'Worker process for background job examples.', 38, true),
  repo('900003003', 'mock-charlie', 'demo-agent', 'Agent demo repository.', 19, true),
  repo('900003004', 'mock-charlie', 'playground', 'Unsubmitted CLI playground.', 6, false),
  repo('900003005', 'mock-charlie', 'side-project', 'Unsubmitted terminal helper.', 3, false),

  repo('900004001', 'mock-diana', 'demo-mobile', 'Mobile prototype for StarBuddy testing.', 84, true),
  repo('900004002', 'mock-diana', 'demo-design', 'Design system mock repository.', 44, true),
  repo('900004003', 'mock-diana', 'demo-lab', 'Lab repository with historical stars.', 18, true),
  repo('900004004', 'mock-diana', 'playground', 'Unsubmitted mobile playground.', 12, false),
  repo('900004005', 'mock-diana', 'side-project', 'Unsubmitted design side project.', 4, false),

  repo('900005001', 'mock-admin', 'demo-admin', 'Admin repository for mock moderation.', 155, true),
  repo('900005002', 'mock-admin', 'demo-tooling', 'Tooling repo for admin account testing.', 57, true),
  repo('900005003', 'mock-admin', 'demo-ops', 'Ops repository for cleanup and reports.', 26, true),
  repo('900005004', 'mock-admin', 'playground', 'Unsubmitted admin playground.', 10, false),
  repo('900005005', 'mock-admin', 'side-project', 'Unsubmitted admin side project.', 8, false),
];

function repo(
  githubRepoId: string,
  owner: string,
  name: string,
  description: string,
  starsCount: number,
  submitted: boolean,
): MockGithubRepository {
  return {
    githubRepoId,
    owner,
    repo: name,
    description,
    starsCount,
    submitted,
  };
}
