import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ReportQueryDto, ResolutionTimeQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AdminGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('ticket-volume')
  getTicketVolume(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.getTicketVolume(query, user);
  }

  @Get('sla-compliance')
  getSlaCompliance(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.getSlaCompliance(query, user);
  }

  @Get('resolution-time')
  getResolutionTime(
    @Query() query: ResolutionTimeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.getResolutionTime(query, user);
  }

  @Get('tickets-by-status')
  getTicketsByStatus(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.getTicketsByStatus(query, user);
  }

  @Get('tickets-by-priority')
  getTicketsByPriority(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.getTicketsByPriority(query, user);
  }

  @Get('agent-performance')
  getAgentPerformance(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.getAgentPerformance(query, user);
  }
}
