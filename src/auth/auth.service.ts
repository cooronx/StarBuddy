import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreditReason, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { CredentialCryptoService } from '../credential-crypto/credential-crypto.service';
import { PrismaService } from '../database/prisma.service';
import { GithubService } from '../github/github.service';

const SIGNUP_BONUS_CREDITS = 5;
const REQUIRED_GITHUB_SCOPES = ['read:user', 'public_repo'];
const LOGIN_CODE_TTL_MS = 60_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly credentialCrypto: CredentialCryptoService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  getGithubOAuthUrl(state: string): string {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.config.githubOAuthClientId);
    url.searchParams.set('redirect_uri', this.config.githubOAuthCallbackUrl);
    url.searchParams.set('scope', REQUIRED_GITHUB_SCOPES.join(' '));
    url.searchParams.set('state', state);
    return url.toString();
  }

  async handleGithubOAuthCallback(code: string): Promise<{ loginCode: string }> {
    const accessToken = await this.github.exchangeOAuthCode({
      clientId: this.config.githubOAuthClientId,
      clientSecret: this.config.githubOAuthClientSecret,
      code,
      redirectUri: this.config.githubOAuthCallbackUrl,
    });
    const authenticated = await this.github.getAuthenticatedUserWithScopes(
      accessToken,
    );

    assertRequiredScopes(authenticated.scopes);

    const encrypted = this.credentialCrypto.encryptSecret(accessToken);

    const user = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { githubUserId: authenticated.user.id },
      });

      if (!existingUser) {
        const created = await tx.user.create({
          data: {
            githubUserId: authenticated.user.id,
            githubLogin: authenticated.user.login,
            avatarUrl: authenticated.user.avatarUrl,
            creditsBalance: SIGNUP_BONUS_CREDITS,
          },
        });

        await tx.creditLedger.create({
          data: {
            userId: created.id,
            amount: SIGNUP_BONUS_CREDITS,
            reason: CreditReason.signup_bonus,
          },
        });

        await tx.githubAuthorization.create({
          data: {
            userId: created.id,
            encryptedAccessToken: encrypted.encryptedSecret,
            accessTokenIv: encrypted.secretIv,
            accessTokenAuthTag: encrypted.secretAuthTag,
            scopes: authenticated.scopes,
            status: 'active',
            lastVerifiedAt: new Date(),
          },
        });

        return created;
      }

      const updated = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          githubLogin: authenticated.user.login,
          avatarUrl: authenticated.user.avatarUrl,
        },
      });

      await tx.githubAuthorization.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          encryptedAccessToken: encrypted.encryptedSecret,
          accessTokenIv: encrypted.secretIv,
          accessTokenAuthTag: encrypted.secretAuthTag,
          scopes: authenticated.scopes,
          status: 'active',
          lastVerifiedAt: new Date(),
        },
        update: {
          encryptedAccessToken: encrypted.encryptedSecret,
          accessTokenIv: encrypted.secretIv,
          accessTokenAuthTag: encrypted.secretAuthTag,
          scopes: authenticated.scopes,
          status: 'active',
          lastVerifiedAt: new Date(),
        },
      });

      return updated;
    });

    const loginCode = randomBytes(32).toString('base64url');
    await this.prisma.oauthLoginCode.create({
      data: {
        codeHash: hashLoginCode(loginCode),
        userId: user.id,
        expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
      },
    });

    return {
      loginCode,
    };
  }

  async createSession(loginCode: string) {
    const codeHash = hashLoginCode(loginCode);

    const user = await this.prisma.$transaction(async (tx) => {
      const codeRecord = await tx.oauthLoginCode.findUnique({
        where: { codeHash },
        include: { user: true },
      });

      if (
        !codeRecord ||
        codeRecord.consumedAt ||
        codeRecord.expiresAt <= new Date()
      ) {
        throw new UnauthorizedException('Login code is invalid or expired');
      }

      const consumed = await tx.oauthLoginCode.updateMany({
        where: {
          id: codeRecord.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Login code is invalid or expired');
      }

      return codeRecord.user;
    });

    return {
      accessToken: this.signUser(user.id, user.githubUserId, user.githubLogin),
      user: serializeUser(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { githubAuthorization: true },
    });

    return {
      ...serializeUser(user),
      githubAuthorizationStatus: user.githubAuthorization?.status ?? null,
      isAdmin: this.config.adminGithubLogins.includes(
        user.githubLogin.toLowerCase(),
      ),
    };
  }

  async assertUserActive(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true },
    });

    if (user.status === UserStatus.suspended) {
      throw new ForbiddenException('Account is suspended');
    }
  }

  async revokeGithubAuthorization(userId: string) {
    await this.prisma.githubAuthorization.update({
      where: { userId },
      data: {
        encryptedAccessToken: null,
        accessTokenIv: null,
        accessTokenAuthTag: null,
        status: 'revoked',
      },
    });

    return { status: 'revoked' };
  }

  async markGithubAuthorizationInvalid(userId: string) {
    await this.prisma.githubAuthorization.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'invalid' },
    });
  }

  async getActiveGithubAccessToken(userId: string): Promise<string> {
    const authorization = await this.prisma.githubAuthorization.findUnique({
      where: { userId },
    });

    if (
      !authorization ||
      authorization.status !== 'active' ||
      !authorization.encryptedAccessToken ||
      !authorization.accessTokenIv ||
      !authorization.accessTokenAuthTag
    ) {
      throw new UnauthorizedException('GitHub authorization is not active');
    }

    return this.credentialCrypto.decryptSecret({
      encryptedSecret: authorization.encryptedAccessToken,
      secretIv: authorization.accessTokenIv,
      secretAuthTag: authorization.accessTokenAuthTag,
    });
  }

  private signUser(
    userId: string,
    githubUserId: bigint,
    githubLogin: string,
  ): string {
    return this.jwtService.sign({
      sub: userId,
      github_user_id: githubUserId.toString(),
      github_login: githubLogin,
    });
  }
}

function assertRequiredScopes(scopes: string[]) {
  const missingScopes = REQUIRED_GITHUB_SCOPES.filter(
    (scope) => !scopes.includes(scope),
  );

  if (missingScopes.length > 0) {
    throw new BadRequestException('GitHub authorization is missing required scopes');
  }
}

function hashLoginCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function serializeUser(user: {
  id: string;
  githubUserId: bigint;
  githubLogin: string;
  avatarUrl: string | null;
  status: UserStatus;
  creditsBalance: number;
}) {
  return {
    id: user.id,
    githubUserId: user.githubUserId.toString(),
    githubLogin: user.githubLogin,
    avatarUrl: user.avatarUrl,
    status: user.status,
    creditsBalance: user.creditsBalance,
  };
}
