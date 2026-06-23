import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';

export class GithubTokenDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(20)
  @Matches(/^ghp_[A-Za-z0-9_]+$/, {
    message:
      'Use a classic GitHub personal access token that starts with ghp_ and has the public_repo scope',
  })
  token: string;
}
