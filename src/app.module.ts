import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { CreditsModule } from './credits/credits.module';
import { DatabaseModule } from './database/database.module';
import { GithubModule } from './github/github.module';
import { HealthModule } from './health/health.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { StarTasksModule } from './star-tasks/star-tasks.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: '7d' },
      }),
    }),
    GithubModule,
    AuthModule,
    RepositoriesModule,
    StarTasksModule,
    CreditsModule,
    HealthModule,
    AdminModule,
  ],
})
export class AppModule {}
