import { TicketPriority, TicketStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

const STATUS_GROUPS = ['open', 'resolved', 'all'] as const;
const SORT_FIELDS = ['createdAt', 'completedAt', 'updatedAt'] as const;
const SORT_ORDER = ['asc', 'desc'] as const;

export class ListTicketsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsIn(STATUS_GROUPS)
  statusGroup?: (typeof STATUS_GROUPS)[number];

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort?: (typeof SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(SORT_ORDER)
  order?: (typeof SORT_ORDER)[number];
}
