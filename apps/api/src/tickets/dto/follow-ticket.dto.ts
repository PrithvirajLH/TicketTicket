import { IsOptional, IsUUID } from 'class-validator';

export class FollowTicketDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
