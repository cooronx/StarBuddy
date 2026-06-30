import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { readRequestIp, RequestWithIp } from '../http/request-ip';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ReportRepositoryDto } from './dto/report-repository.dto';
import { RepositoriesService } from './repositories.service';

@Controller('repositories')
@UseGuards(JwtAuthGuard)
export class RepositoriesController {
  constructor(
    private readonly repositoriesService: RepositoriesService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('github/:githubRepoId')
  async createFromGithubRepository(
    @CurrentUser() user: AuthenticatedUser,
    @Param('githubRepoId') githubRepoId: string,
    @Req() request: RequestWithIp,
  ) {
    await this.rateLimit.consume({
      eventType: 'repository_submit',
      userId: user.userId,
      ipAddress: readRequestIp(request),
      maxEvents: 30,
      windowMs: 24 * 60 * 60 * 1000,
    });

    return this.repositoriesService.createFromGithubRepository(
      user.userId,
      user.githubLogin,
      githubRepoId,
    );
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.repositoriesService.listMine(user.userId);
  }

  @Get('github/mine')
  listGithubMine(@CurrentUser() user: AuthenticatedUser) {
    return this.repositoriesService.listGithubMine(
      user.userId,
      user.githubLogin,
    );
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.repositoriesService.activate(user.userId, id);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.repositoriesService.pause(user.userId, id);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.repositoriesService.resume(user.userId, id);
  }

  @Post(':id/report')
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReportRepositoryDto,
    @Req() request: RequestWithIp,
  ) {
    await this.rateLimit.consume({
      eventType: 'repository_report',
      userId: user.userId,
      ipAddress: readRequestIp(request),
      maxEvents: 20,
      windowMs: 24 * 60 * 60 * 1000,
    });

    return this.repositoriesService.report(user.userId, id, body.reason);
  }
}
