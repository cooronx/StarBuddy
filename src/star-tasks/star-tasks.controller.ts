import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { StarTasksService } from './star-tasks.service';

@Controller('star-tasks')
@UseGuards(JwtAuthGuard)
export class StarTasksController {
  constructor(private readonly starTasksService: StarTasksService) {}

  @Post('execute-next')
  executeNext(@CurrentUser() user: AuthenticatedUser) {
    return this.starTasksService.executeNext(user.userId);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.starTasksService.getCurrent(user.userId);
  }

  @Post(':claimId/star')
  starClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId') claimId: string,
  ) {
    return this.starTasksService.starClaim(user.userId, claimId);
  }

  @Post(':claimId/skip')
  skipClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId') claimId: string,
  ) {
    return this.starTasksService.skipClaim(user.userId, claimId);
  }
}
