import { BadRequestException } from '@nestjs/common';

export function parseGithubRepositoryUrl(url: string): {
  owner: string;
  repo: string;
} {
  const trimmed = url.trim();
  const match = trimmed.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)?([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/,
  );

  if (!match) {
    throw new BadRequestException('Invalid GitHub repository URL');
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}
