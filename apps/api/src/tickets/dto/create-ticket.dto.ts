import { TicketChannel, TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
}
