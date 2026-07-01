import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  readonly port = Number(process.env.PORT ?? 3000);
  readonly host = process.env.HOST ?? '127.0.0.1';
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly databaseUrl = requiredEnv('DATABASE_URL');
  readonly jwtSecret = requiredEnv('JWT_SECRET');
  readonly githubOAuthClientId = requiredEnv('GITHUB_OAUTH_CLIENT_ID');
  readonly githubOAuthClientSecret = requiredEnv('GITHUB_OAUTH_CLIENT_SECRET');
  readonly githubOAuthCallbackUrl = requiredEnv('GITHUB_OAUTH_CALLBACK_URL');
  readonly webAppUrl = requiredEnv('WEB_APP_URL');
  readonly corsOrigins = parseList(process.env.CORS_ORIGINS ?? this.webAppUrl);
  readonly adminGithubLogins = parseList(process.env.ADMIN_GITHUB_LOGINS).map(
    (login) => login.toLowerCase(),
  );
  readonly starTasksEnabled = parseBoolean(
    process.env.STAR_TASKS_ENABLED,
    true,
  );
  readonly repositoryPromotionEnabled = parseBoolean(
    process.env.REPOSITORY_PROMOTION_ENABLED,
    true,
  );
  readonly githubRequestTimeoutMs = parsePositiveInteger(
    process.env.GITHUB_REQUEST_TIMEOUT_MS,
    10_000,
  );
  readonly cleanupIntervalMs = parsePositiveInteger(
    process.env.CLEANUP_INTERVAL_MS,
    6 * 60 * 60 * 1000,
  );
  readonly mockGithubEnabled = parseMockGithubEnabled();
  readonly credentialEncryptionKey = parseEncryptionKey(
    requiredEnv('CREDENTIAL_ENCRYPTION_KEY'),
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY must be a base64 encoded 32-byte key',
    );
  }
  return key;
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(`Invalid boolean environment variable value: ${value}`);
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }

  return parsed;
}

function parseMockGithubEnabled(): boolean {
  const enabled = parseBoolean(process.env.MOCK_GITHUB, false);
  if (enabled && process.env.NODE_ENV === 'production') {
    throw new Error('MOCK_GITHUB cannot be enabled in production');
  }

  return enabled;
}
