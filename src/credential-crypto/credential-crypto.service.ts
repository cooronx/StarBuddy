import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppConfigService } from '../config/app-config.service';

export interface EncryptedSecret {
  encryptedSecret: string;
  secretIv: string;
  secretAuthTag: string;
}

@Injectable()
export class CredentialCryptoService {
  constructor(private readonly config: AppConfigService) {}

  encryptSecret(secret: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.config.credentialEncryptionKey,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedSecret: encrypted.toString('base64'),
      secretIv: iv.toString('base64'),
      secretAuthTag: authTag.toString('base64'),
    };
  }

  decryptSecret(record: EncryptedSecret): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.config.credentialEncryptionKey,
      Buffer.from(record.secretIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(record.secretAuthTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedSecret, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
