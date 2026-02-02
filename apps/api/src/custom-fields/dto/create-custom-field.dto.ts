import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCustomFieldDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(32)
  fieldType: string; // TEXT, TEXTAREA, NUMBER, DROPDOWN, MULTISELECT, DATE, CHECKBOX, USER

  @IsOptional()
  options?: unknown; // [{ value, label }] for DROPDOWN/MULTISELECT

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  sortOrder?: number;
}
