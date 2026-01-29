import { IsArray, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticketIds: string[];

  @IsUUID()
  newTeamId: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
