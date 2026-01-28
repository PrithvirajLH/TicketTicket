import { MessageType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddTicketMessageDto {
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsString()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;
}
