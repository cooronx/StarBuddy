import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportRepositoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
