import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { GithubService } from './github.service';

@Module({
  imports: [ConfigModule],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
