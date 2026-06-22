import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppConfigService } from '../config/app-config.service';

export interface EncryptedToken {
  encryptedToken: string;
  tokenIv: string;
  tokenAuthTag: string;
}

@Injectable()
export class TokenCryptoService {
  constructor(private readonly config: AppConfigService) {}

  encryptToken(token: string): EncryptedToken {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.config.tokenEncryptionKey,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedToken: encrypted.toString('base64'),
      tokenIv: iv.toString('base64'),
      tokenAuthTag: authTag.toString('base64'),
    };
  }

  decryptToken(record: EncryptedToken): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.config.tokenEncryptionKey,
      Buffer.from(record.tokenIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(record.tokenAuthTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedToken, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
