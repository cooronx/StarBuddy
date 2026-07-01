import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { readRequestIp, RequestWithIp } from '../http/request-ip';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { CurrentUser } from './current-user.decorator';
import { OAuthSessionDto } from './dto/oauth-session.dto';
import { MockSessionDto } from './dto/mock-session.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser } from './types';
import { AuthService } from './auth.service';

const STATE_COOKIE_NAME = 'github_oauth_state';
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

interface OAuthRequest extends RequestWithIp {
  headers: RequestWithIp['headers'] & {
    cookie?: string;
  };
}

interface OAuthResponse {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: 'lax';
      secure: boolean;
      maxAge: number;
      path: string;
    },
  ): void;
  clearCookie(name: string, options: { path: string }): void;
  redirect(url: string): void;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('github')
  async startGithubOAuth(
    @Req() request: OAuthRequest,
    @Res() response: OAuthResponse,
  ) {
    await this.rateLimit.consume({
      eventType: 'oauth_start',
      ipAddress: readRequestIp(request),
      maxEvents: 20,
      windowMs: 10 * 60 * 1000,
    });

    const state = randomBytes(24).toString('base64url');
    response.cookie(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: STATE_COOKIE_MAX_AGE_MS,
      path: '/auth/github',
    });
    response.redirect(this.authService.getGithubOAuthUrl(state));
  }

  @Get('github/callback')
  async finishGithubOAuth(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: OAuthRequest,
    @Res() response: OAuthResponse,
  ) {
    response.clearCookie(STATE_COOKIE_NAME, { path: '/auth/github' });

    if (error) {
      return response.redirect(
        this.webCallbackUrl(
          error === 'access_denied' ? 'access_denied' : 'github_oauth_failed',
        ),
      );
    }

    const expectedState = readCookie(request, STATE_COOKIE_NAME);
    if (!state || !expectedState || state !== expectedState) {
      return response.redirect(this.webCallbackUrl('state_mismatch'));
    }

    if (!code) {
      return response.redirect(this.webCallbackUrl('github_oauth_failed'));
    }

    try {
      const session = await this.authService.handleGithubOAuthCallback(code);
      return response.redirect(this.webCallbackUrl(undefined, session.loginCode));
    } catch (callbackError) {
      this.logger.error('GitHub OAuth callback failed', callbackError);
      const errorCode =
        callbackError instanceof BadRequestException
          ? 'insufficient_scope'
          : 'github_oauth_failed';
      return response.redirect(this.webCallbackUrl(errorCode));
    }
  }

  @Post('session')
  createSession(@Body() body: OAuthSessionDto) {
    return this.authService.createSession(body.code);
  }

  @Get('mock-users')
  listMockUsers() {
    return this.authService.listMockUsers();
  }

  @Post('mock-session')
  createMockSession(@Body() body: MockSessionDto) {
    return this.authService.createMockSession(body.login);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  @Delete('github-authorization')
  @UseGuards(JwtAuthGuard)
  revokeGithubAuthorization(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeGithubAuthorization(user.userId);
  }

  private webCallbackUrl(error?: string, code?: string): string {
    const url = new URL('/auth/callback', this.config.webAppUrl);
    if (error) {
      url.searchParams.set('error', error);
    }
    if (code) {
      url.searchParams.set('code', code);
    }
    return url.toString();
  }
}

function readCookie(request: OAuthRequest, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .map((cookie) => cookie.split('='))
    .find(([cookieName]) => cookieName === name)?.[1];
}
