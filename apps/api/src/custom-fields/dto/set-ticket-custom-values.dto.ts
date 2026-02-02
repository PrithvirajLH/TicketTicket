import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomFieldValueItemDto {
  @IsUUID()
  customFieldId: string;

  @IsOptional()
  @IsString()
  value?: string | null;
}

export class SetTicketCustomValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldValueItemDto)
  values: CustomFieldValueItemDto[];
}
