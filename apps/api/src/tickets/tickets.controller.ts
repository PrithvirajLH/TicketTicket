import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { TransitionTicketDto } from './dto/transition-ticket.dto';
import { TransferTicketDto } from './dto/transfer-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  async list(@Query() query: ListTicketsDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.list(query, user);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.getById(id, user);
  }

  @Post()
  async create(@Body() payload: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.create(payload, user);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() payload: AddTicketMessageDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.ticketsService.addMessage(id, payload, user);
  }

  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() payload: AssignTicketDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.ticketsService.assign(id, payload, user);
  }

  @Post(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() payload: TransferTicketDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.ticketsService.transfer(id, payload, user);
  }

  @Post(':id/transition')
  async transition(
    @Param('id') id: string,
    @Body() payload: TransitionTicketDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.ticketsService.transition(id, payload, user);
  }
}
