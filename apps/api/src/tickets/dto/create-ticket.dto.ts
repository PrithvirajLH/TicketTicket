import { TicketChannel, TicketPriority } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomFieldValueItemDto {
  @IsUUID()
  customFieldId: string;

  @IsOptional()
  @IsString()
  value?: string | null;
}

export class CreateTicketDto {
  @IsString()
  @MaxLength(160)
  subject: string;

  @IsString()
  @MaxLength(4000)
  description: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketChannel)
  channel?: TicketChannel;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsUUID()
  assignedTeamId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldValueItemDto)
  customFieldValues?: CustomFieldValueItemDto[];
}
