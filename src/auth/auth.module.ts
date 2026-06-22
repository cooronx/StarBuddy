import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { TokenCryptoModule } from '../token-crypto/token-crypto.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [GithubModule, TokenCryptoModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
