import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { TokenCryptoService } from './token-crypto.service';

@Module({
  imports: [ConfigModule],
  providers: [TokenCryptoService],
  exports: [TokenCryptoService],
})
export class TokenCryptoModule {}
