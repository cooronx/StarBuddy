import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { GithubModule } from '../github/github.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { StarTasksController } from './star-tasks.controller';
import { StarTasksService } from './star-tasks.service';

@Module({
  imports: [AuthModule, ConfigModule, GithubModule, RateLimitModule],
  controllers: [StarTasksController],
  providers: [StarTasksService],
})
export class StarTasksModule {}
