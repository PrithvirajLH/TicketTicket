import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';
import { RoutingRulesService } from './routing.service';

@Controller('routing-rules')
export class RoutingRulesController {
  constructor(private readonly routingRulesService: RoutingRulesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.routingRulesService.list(user);
  }

  @Post()
  async create(
    @Body() payload: CreateRoutingRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.routingRulesService.create(payload, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateRoutingRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.routingRulesService.update(id, payload, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.routingRulesService.remove(id, user);
  }
}
