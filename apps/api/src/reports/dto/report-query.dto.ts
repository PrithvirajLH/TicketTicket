import { TicketPriority } from '@prisma/client';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class ResolutionTimeQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsIn(['team', 'priority'])
  groupBy?: 'team' | 'priority';
}
