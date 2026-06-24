import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { CredentialCryptoService } from './credential-crypto.service';

@Module({
  imports: [ConfigModule],
  providers: [CredentialCryptoService],
  exports: [CredentialCryptoService],
})
export class CredentialCryptoModule {}
