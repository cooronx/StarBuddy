import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { CredentialCryptoModule } from '../credential-crypto/credential-crypto.module';
import { GithubModule } from '../github/github.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [ConfigModule, GithubModule, CredentialCryptoModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
