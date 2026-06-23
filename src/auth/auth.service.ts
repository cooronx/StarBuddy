import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreditReason } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { GithubService } from '../github/github.service';
import { TokenCryptoService } from '../token-crypto/token-crypto.service';

const SIGNUP_BONUS_CREDITS = 5;
const GITHUB_TOKEN_TYPE = 'classic_pat';
const GITHUB_TOKEN_PERMISSIONS = {
  required: ['classic:public_repo'],
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly jwtService: JwtService,
  ) {}

  async bindGithubToken(token: string) {
    const normalizedToken = token.trim();
    const githubUser = await this.github.getAuthenticatedUser(normalizedToken);
    const encrypted = this.tokenCrypto.encryptToken(normalizedToken);

    const user = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { githubUserId: githubUser.id },
      });

      if (!existingUser) {
        const created = await tx.user.create({
          data: {
            githubUserId: githubUser.id,
            githubLogin: githubUser.login,
            avatarUrl: githubUser.avatarUrl,
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

        await tx.githubToken.create({
          data: {
            userId: created.id,
            encryptedToken: encrypted.encryptedToken,
            tokenIv: encrypted.tokenIv,
            tokenAuthTag: encrypted.tokenAuthTag,
            tokenType: GITHUB_TOKEN_TYPE,
            permissionsSnapshot: GITHUB_TOKEN_PERMISSIONS,
            status: 'active',
            lastVerifiedAt: new Date(),
          },
        });

        return created;
      }

      const updated = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          githubLogin: githubUser.login,
          avatarUrl: githubUser.avatarUrl,
        },
      });

      await tx.githubToken.upsert({
        where: { userId: updated.id },
        create: {
          userId: updated.id,
          encryptedToken: encrypted.encryptedToken,
          tokenIv: encrypted.tokenIv,
          tokenAuthTag: encrypted.tokenAuthTag,
          tokenType: GITHUB_TOKEN_TYPE,
          permissionsSnapshot: GITHUB_TOKEN_PERMISSIONS,
          status: 'active',
          lastVerifiedAt: new Date(),
        },
        update: {
          encryptedToken: encrypted.encryptedToken,
          tokenIv: encrypted.tokenIv,
          tokenAuthTag: encrypted.tokenAuthTag,
          tokenType: GITHUB_TOKEN_TYPE,
          permissionsSnapshot: GITHUB_TOKEN_PERMISSIONS,
          status: 'active',
          lastVerifiedAt: new Date(),
        },
      });

      return updated;
    });

    return {
      accessToken: this.signUser(user.id, user.githubUserId, user.githubLogin),
      user: serializeUser(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { token: true },
    });

    return {
      ...serializeUser(user),
      githubTokenStatus: user.token?.status ?? null,
    };
  }

  async revokeGithubToken(userId: string) {
    await this.prisma.githubToken.update({
      where: { userId },
      data: {
        encryptedToken: null,
        tokenIv: null,
        tokenAuthTag: null,
        status: 'revoked',
      },
    });

    return { status: 'revoked' };
  }

  async getActivePlainToken(userId: string): Promise<string> {
    const token = await this.prisma.githubToken.findUnique({
      where: { userId },
    });

    if (
      !token ||
      token.status !== 'active' ||
      !token.encryptedToken ||
      !token.tokenIv ||
      !token.tokenAuthTag
    ) {
      throw new UnauthorizedException('GitHub token is not active');
    }

    return this.tokenCrypto.decryptToken({
      encryptedToken: token.encryptedToken,
      tokenIv: token.tokenIv,
      tokenAuthTag: token.tokenAuthTag,
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

function serializeUser(user: {
  id: string;
  githubUserId: bigint;
  githubLogin: string;
  avatarUrl: string | null;
  creditsBalance: number;
}) {
  return {
    id: user.id,
    githubUserId: user.githubUserId.toString(),
    githubLogin: user.githubLogin,
    avatarUrl: user.avatarUrl,
    creditsBalance: user.creditsBalance,
  };
}
