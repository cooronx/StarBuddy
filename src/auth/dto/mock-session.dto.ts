import { IsString } from 'class-validator';

export class MockSessionDto {
  @IsString()
  login!: string;
}
