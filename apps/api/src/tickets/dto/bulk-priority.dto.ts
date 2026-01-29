import { TicketPriority } from '@prisma/client';
import { IsArray, IsEnum, ArrayMinSize, IsUUID } from 'class-validator';

export class BulkPriorityDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticketIds: string[];

  @IsEnum(TicketPriority)
  priority: TicketPriority;
}
