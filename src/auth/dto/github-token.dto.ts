import { IsString, MinLength } from 'class-validator';

export class GithubTokenDto {
  @IsString()
  @MinLength(20)
  token: string;
}
