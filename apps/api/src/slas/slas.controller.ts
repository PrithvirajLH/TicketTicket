import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ListSlasDto } from './dto/list-slas.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla.dto';
import { SlasService } from './slas.service';

@Controller('slas')
export class SlasController {
  constructor(private readonly slasService: SlasService) {}

  @Get()
  async list(@Query() query: ListSlasDto, @CurrentUser() user: AuthUser) {
    return this.slasService.list(query, user);
  }

  @Put(':teamId')
  async update(
    @Param('teamId') teamId: string,
    @Body() payload: UpdateSlaPolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.slasService.update(teamId, payload, user);
  }

  @Delete(':teamId')
  async reset(@Param('teamId') teamId: string, @CurrentUser() user: AuthUser) {
    return this.slasService.reset(teamId, user);
  }
}
