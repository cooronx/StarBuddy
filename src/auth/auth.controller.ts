import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { GithubTokenDto } from './dto/github-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser } from './types';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('github-token')
  bindGithubToken(@Body() body: GithubTokenDto) {
    return this.authService.bindGithubToken(body.token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  @Delete('github-token')
  @UseGuards(JwtAuthGuard)
  revokeGithubToken(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeGithubToken(user.userId);
  }
}
