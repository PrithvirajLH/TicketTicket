import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsDto } from './dto/list-teams.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async list(@Query() query: ListTeamsDto) {
    return this.teamsService.list(query);
  }

  @Post()
  async create(@Body() payload: CreateTeamDto) {
    return this.teamsService.create(payload);
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.teamsService.listMembers(id, user);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() payload: AddTeamMemberDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.teamsService.addMember(id, payload, user);
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() payload: UpdateTeamMemberDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.teamsService.updateMember(id, memberId, payload, user);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.teamsService.removeMember(id, memberId, user);
  }
}
