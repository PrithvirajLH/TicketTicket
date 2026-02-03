import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketPriority, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ListSlasDto } from './dto/list-slas.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla.dto';

const PRIORITIES: TicketPriority[] = [
  TicketPriority.P1,
  TicketPriority.P2,
  TicketPriority.P3,
  TicketPriority.P4,
];

@Injectable()
export class SlasService {
  constructor(private readonly prisma: PrismaService) {}

  private defaultSlaConfig: Record<
    TicketPriority,
    { firstResponseHours: number; resolutionHours: number }
  > = {
    [TicketPriority.P1]: { firstResponseHours: 1, resolutionHours: 4 },
    [TicketPriority.P2]: { firstResponseHours: 4, resolutionHours: 24 },
    [TicketPriority.P3]: { firstResponseHours: 8, resolutionHours: 72 },
    [TicketPriority.P4]: { firstResponseHours: 24, resolutionHours: 168 },
  };

  async list(query: ListSlasDto, user: AuthUser) {
    this.ensureTeamAdminOrOwner(user, query.teamId);
    await this.ensureTeam(query.teamId);

    const policies = await this.prisma.slaPolicy.findMany({
      where: { teamId: query.teamId },
    });

    const policyMap = new Map(
      policies.map((policy) => [policy.priority, policy]),
    );

    return {
      data: PRIORITIES.map((priority) => {
        const teamPolicy = policyMap.get(priority);
        const defaults = this.defaultSlaConfig[priority];
        return {
          priority,
          firstResponseHours:
            teamPolicy?.firstResponseHours ?? defaults.firstResponseHours,
          resolutionHours:
            teamPolicy?.resolutionHours ?? defaults.resolutionHours,
          source: teamPolicy ? 'team' : 'default',
        };
      }),
    };
  }

  async update(teamId: string, payload: UpdateSlaPolicyDto, user: AuthUser) {
    this.ensureTeamAdminOrOwner(user, teamId);
    await this.ensureTeam(teamId);

    const policies = payload.policies ?? [];

    await this.prisma.$transaction(
      policies.map((policy) =>
        this.prisma.slaPolicy.upsert({
          where: {
            teamId_priority: {
              teamId,
              priority: policy.priority,
            },
          },
          update: {
            firstResponseHours: policy.firstResponseHours,
            resolutionHours: policy.resolutionHours,
          },
          create: {
            teamId,
            priority: policy.priority,
            firstResponseHours: policy.firstResponseHours,
            resolutionHours: policy.resolutionHours,
          },
        }),
      ),
    );

    return this.list({ teamId }, user);
  }

  async reset(teamId: string, user: AuthUser) {
    this.ensureTeamAdminOrOwner(user, teamId);
    await this.ensureTeam(teamId);

    await this.prisma.slaPolicy.deleteMany({ where: { teamId } });

    return this.list({ teamId }, user);
  }

  private ensureTeamAdminOrOwner(user: AuthUser, teamId: string) {
    if (user.role === UserRole.OWNER) return;
    if (user.role === UserRole.TEAM_ADMIN && user.primaryTeamId === teamId) return;
    throw new ForbiddenException('Team admin or owner access required');
  }

  private async ensureTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
  }
}
