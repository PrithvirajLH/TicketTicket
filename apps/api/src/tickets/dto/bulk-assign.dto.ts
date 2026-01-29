import { IsArray, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkAssignDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticketIds: string[];

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
