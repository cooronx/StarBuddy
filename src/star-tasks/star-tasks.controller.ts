import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { readRequestIp, RequestWithIp } from '../http/request-ip';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { StarTasksService } from './star-tasks.service';

@Controller('star-tasks')
@UseGuards(JwtAuthGuard)
export class StarTasksController {
  constructor(
    private readonly starTasksService: StarTasksService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('execute-next')
  async executeNext(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithIp,
  ) {
    await this.consumeTaskClaimRateLimit(user, request);
    return this.starTasksService.executeNext(user.userId);
  }

  @Get('current')
  async getCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithIp,
  ) {
    await this.consumeTaskClaimRateLimit(user, request);
    return this.starTasksService.getCurrent(user.userId);
  }

  @Post(':claimId/star')
  async starClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId') claimId: string,
    @Req() request: RequestWithIp,
  ) {
    await this.rateLimit.consume({
      eventType: 'task_star',
      userId: user.userId,
      ipAddress: readRequestIp(request),
      maxEvents: 60,
      windowMs: 60 * 60 * 1000,
    });

    return this.starTasksService.starClaim(user.userId, claimId);
  }

  @Post(':claimId/skip')
  skipClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId') claimId: string,
  ) {
    return this.starTasksService.skipClaim(user.userId, claimId);
  }

  private consumeTaskClaimRateLimit(
    user: AuthenticatedUser,
    request: RequestWithIp,
  ) {
    return this.rateLimit.consume({
      eventType: 'task_claim',
      userId: user.userId,
      ipAddress: readRequestIp(request),
      maxEvents: 120,
      windowMs: 60 * 60 * 1000,
    });
  }
}
