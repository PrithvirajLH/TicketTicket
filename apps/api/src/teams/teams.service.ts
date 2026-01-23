import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamRole, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsDto } from './dto/list-teams.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTeamsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      isActive: true,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { description: { contains: query.q, mode: 'insensitive' as const } }
          ]
        : undefined
    };

    const [total, data] = await Promise.all([
      this.prisma.team.count({ where }),
      this.prisma.team.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' }
      })
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  async create(payload: CreateTeamDto) {
    const slug = payload.slug ?? this.slugify(payload.name);

    return this.prisma.team.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description
      }
    });
  }

  async listMembers(teamId: string, user: AuthUser) {
    this.ensureAdmin(user);

    await this.ensureTeam(teamId);

    const data = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true, team: true },
      orderBy: { createdAt: 'asc' }
    });

    return { data };
  }

  async addMember(teamId: string, payload: AddTeamMemberDto, user: AuthUser) {
    this.ensureAdmin(user);

    await this.ensureTeam(teamId);
    await this.ensureUser(payload.userId);

    return this.prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId,
          userId: payload.userId
        }
      },
      update: {
        role: payload.role ?? TeamRole.AGENT
      },
      create: {
        teamId,
        userId: payload.userId,
        role: payload.role ?? TeamRole.AGENT
      },
      include: { user: true, team: true }
    });
  }

  async updateMember(teamId: string, memberId: string, payload: UpdateTeamMemberDto, user: AuthUser) {
    this.ensureAdmin(user);

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Team member not found');
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role: payload.role },
      include: { user: true, team: true }
    });
  }

  async removeMember(teamId: string, memberId: string, user: AuthUser) {
    this.ensureAdmin(user);

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Team member not found');
    }

    await this.prisma.teamMember.delete({ where: { id: memberId } });

    return { id: memberId };
  }

  private ensureAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private async ensureTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
}
