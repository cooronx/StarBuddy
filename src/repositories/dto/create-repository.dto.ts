import { IsString, MinLength } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  @MinLength(3)
  url: string;
}
