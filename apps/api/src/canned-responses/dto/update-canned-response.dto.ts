import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCannedResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;
}
