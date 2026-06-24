import { IsNotEmpty, IsString } from 'class-validator';

export class OAuthSessionDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
