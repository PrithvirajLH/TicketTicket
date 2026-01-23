import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
