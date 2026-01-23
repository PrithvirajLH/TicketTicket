import { Controller, Get, Query } from '@nestjs/common';
import { ListUsersDto } from './dto/list-users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query() query: ListUsersDto) {
    return this.usersService.list(query);
  }
}
