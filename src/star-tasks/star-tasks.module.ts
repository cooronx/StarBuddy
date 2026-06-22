import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GithubModule } from '../github/github.module';
import { StarTasksController } from './star-tasks.controller';
import { StarTasksService } from './star-tasks.service';

@Module({
  imports: [AuthModule, GithubModule],
  controllers: [StarTasksController],
  providers: [StarTasksService],
})
export class StarTasksModule {}
