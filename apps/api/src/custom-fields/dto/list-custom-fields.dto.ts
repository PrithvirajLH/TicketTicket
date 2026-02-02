import { IsOptional, IsUUID } from 'class-validator';

export class ListCustomFieldsDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
