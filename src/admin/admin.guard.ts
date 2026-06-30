import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AuthenticatedUser } from '../auth/types';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const login = request.user?.githubLogin.toLowerCase();

    if (!login || !this.config.adminGithubLogins.includes(login)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
