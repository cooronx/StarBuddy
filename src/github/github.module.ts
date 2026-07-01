import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { MockGithubClient } from './mock-github.client';
import { GITHUB_CLIENT, RealGithubClient } from './github.service';

@Module({
  imports: [ConfigModule],
  providers: [
    RealGithubClient,
    MockGithubClient,
    {
      provide: GITHUB_CLIENT,
      inject: [AppConfigService, RealGithubClient, MockGithubClient],
      useFactory: (
        config: AppConfigService,
        realGithub: RealGithubClient,
        mockGithub: MockGithubClient,
      ) => (config.mockGithubEnabled ? mockGithub : realGithub),
    },
  ],
  exports: [GITHUB_CLIENT, RealGithubClient],
})
export class GithubModule {}
