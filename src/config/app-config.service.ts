import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  readonly port = Number(process.env.PORT ?? 3000);
  readonly host = process.env.HOST ?? '127.0.0.1';
  readonly databaseUrl = requiredEnv('DATABASE_URL');
  readonly jwtSecret = requiredEnv('JWT_SECRET');
  readonly tokenEncryptionKey = parseEncryptionKey(
    requiredEnv('TOKEN_ENCRYPTION_KEY'),
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
    throw new Error('TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
  }
  return key;
}
