import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [DatabaseModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
