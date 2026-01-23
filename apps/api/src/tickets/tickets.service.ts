import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AccessLevel, Prisma, TicketStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { TransitionTicketDto } from './dto/transition-ticket.dto';
import { TransferTicketDto } from './dto/transfer-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTicketsDto, user: AuthUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const filters: Prisma.TicketWhereInput[] = [];

    if (query.status) {
      filters.push({ status: query.status });
    }

    if (query.priority) {
      filters.push({ priority: query.priority });
    }

    if (query.teamId) {
      filters.push({ assignedTeamId: query.teamId });
    }

    if (query.assigneeId) {
      filters.push({ assigneeId: query.assigneeId });
    }

    if (query.requesterId) {
      filters.push({ requesterId: query.requesterId });
    }

    if (query.q) {
      filters.push({
        OR: [
          { subject: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } }
        ]
      });
    }

    filters.push(this.buildAccessFilter(user));

    const where = filters.length > 1 ? { AND: filters } : filters[0] ?? {};

    const [total, data] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          requester: true,
          assignee: true,
          assignedTeam: true,
          category: true
        }
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

  async getById(id: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: true,
        assignee: true,
        assignedTeam: true,
        category: true,
        accessGrants: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: true }
        },
        events: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!this.canViewTicket(user, ticket)) {
      throw new ForbiddenException('No access to this ticket');
    }

    return ticket;
  }

  async create(payload: CreateTicketDto, user: AuthUser) {
    const requesterId = payload.requesterId ?? user.id;

    if (user.role === UserRole.EMPLOYEE && requesterId !== user.id) {
      throw new ForbiddenException('Requesters can only create their own tickets');
    }

    const routedTeamId =
      payload.assignedTeamId ?? (await this.routeTeam(payload.subject, payload.description));

    const ticket = await this.prisma.ticket.create({
      data: {
        subject: payload.subject,
        description: payload.description,
        priority: payload.priority,
        channel: payload.channel,
        requesterId,
        assignedTeamId: routedTeamId,
        assigneeId: payload.assigneeId,
        categoryId: payload.categoryId,
        status: TicketStatus.NEW
      },
      include: {
        requester: true,
        assignee: true,
        assignedTeam: true
      }
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'TICKET_CREATED',
        payload: {
          subject: ticket.subject,
          priority: ticket.priority,
          channel: ticket.channel
        },
        createdById: payload.requesterId
      }
    });

    return ticket;
  }

  async addMessage(ticketId: string, payload: AddTicketMessageDto, user: AuthUser) {
    if (payload.authorId && payload.authorId !== user.id) {
      throw new ForbiddenException('Message author must match current user');
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user.role === UserRole.EMPLOYEE) {
      if (ticket.requesterId !== user.id) {
        throw new ForbiddenException('Requesters can only reply to their own tickets');
      }
      if (payload.type && payload.type !== 'PUBLIC') {
        throw new ForbiddenException('Requesters can only add public replies');
      }
    }

    if (!this.canWriteTicket(user, ticket)) {
      throw new ForbiddenException('No write access to this ticket');
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        authorId: user.id,
        body: payload.body,
        type: payload.type
      },
      include: {
        author: true
      }
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        type: 'MESSAGE_ADDED',
        payload: {
          messageId: message.id,
          type: message.type
        },
        createdById: payload.authorId
      }
    });

    return message;
  }

  async assign(ticketId: string, payload: AssignTicketDto, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignedTeam: true }
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!this.canAssignTicket(user, ticket, payload.assigneeId)) {
      throw new ForbiddenException('Not allowed to assign this ticket');
    }

    const assigneeId = payload.assigneeId ?? user.id;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigneeId
      },
      include: {
        requester: true,
        assignee: true,
        assignedTeam: true
      }
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'TICKET_ASSIGNED',
        payload: { assigneeId },
        createdById: user.id
      }
    });

    return updated;
  }

  async transfer(ticketId: string, payload: TransferTicketDto, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Requesters cannot transfer tickets');
    }

    if (!this.canWriteTicket(user, ticket)) {
      throw new ForbiddenException('No write access to transfer this ticket');
    }

    const priorTeamId = ticket.assignedTeamId;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedTeamId: payload.newTeamId,
        assigneeId: payload.assigneeId ?? null
      },
      include: {
        requester: true,
        assignee: true,
        assignedTeam: true
      }
    });

    if (priorTeamId && priorTeamId !== payload.newTeamId) {
      await this.prisma.ticketAccess.upsert({
        where: {
          ticketId_teamId: {
            ticketId,
            teamId: priorTeamId
          }
        },
        update: { accessLevel: AccessLevel.READ },
        create: {
          ticketId,
          teamId: priorTeamId,
          accessLevel: AccessLevel.READ
        }
      });

      await this.prisma.ticketAccess.deleteMany({
        where: {
          ticketId,
          teamId: payload.newTeamId
        }
      });
    }

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'TICKET_TRANSFERRED',
        payload: {
          fromTeamId: priorTeamId,
          toTeamId: payload.newTeamId,
          assigneeId: payload.assigneeId ?? null
        },
        createdById: user.id
      }
    });

    return updated;
  }

  async transition(ticketId: string, payload: TransitionTicketDto, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Requesters cannot transition tickets');
    }

    if (!this.canWriteTicket(user, ticket)) {
      throw new ForbiddenException('No write access to transition this ticket');
    }

    if (!this.isValidTransition(ticket.status, payload.status)) {
      throw new ForbiddenException('Invalid status transition');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: payload.status,
        resolvedAt: payload.status === TicketStatus.RESOLVED ? new Date() : payload.status === TicketStatus.REOPENED ? null : ticket.resolvedAt,
        closedAt: payload.status === TicketStatus.CLOSED ? new Date() : payload.status === TicketStatus.REOPENED ? null : ticket.closedAt
      },
      include: {
        requester: true,
        assignee: true,
        assignedTeam: true
      }
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: 'TICKET_STATUS_CHANGED',
        payload: {
          from: ticket.status,
          to: payload.status
        },
        createdById: user.id
      }
    });

    return updated;
  }

  private buildAccessFilter(user: AuthUser): Prisma.TicketWhereInput {
    if (user.role === UserRole.ADMIN) {
      return {};
    }

    if (user.role === UserRole.EMPLOYEE) {
      return { requesterId: user.id };
    }

    if (!user.teamId) {
      return { requesterId: user.id };
    }

    if (user.role === UserRole.LEAD) {
      return {
        OR: [
          { assignedTeamId: user.teamId },
          { accessGrants: { some: { teamId: user.teamId } } }
        ]
      };
    }

    return {
      OR: [
        { assignedTeamId: user.teamId, assigneeId: user.id },
        { assignedTeamId: user.teamId, assigneeId: null },
        { accessGrants: { some: { teamId: user.teamId } } }
      ]
    };
  }

  private canViewTicket(user: AuthUser, ticket: { requesterId: string; assignedTeamId: string | null; assigneeId: string | null; accessGrants?: { teamId: string }[] }) {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (user.role === UserRole.EMPLOYEE) {
      return ticket.requesterId === user.id;
    }

    if (!user.teamId) {
      return ticket.requesterId === user.id;
    }

    const hasReadGrant = ticket.accessGrants?.some((grant) => grant.teamId === user.teamId) ?? false;

    if (user.role === UserRole.LEAD) {
      return ticket.assignedTeamId === user.teamId || hasReadGrant;
    }

    const isAgentAccess =
      ticket.assignedTeamId === user.teamId &&
      (ticket.assigneeId === user.id || ticket.assigneeId === null);

    return isAgentAccess || hasReadGrant;
  }

  private canWriteTicket(user: AuthUser, ticket: { requesterId: string; assignedTeamId: string | null; assigneeId: string | null }) {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (user.role === UserRole.EMPLOYEE) {
      return ticket.requesterId === user.id;
    }

    if (!user.teamId) {
      return false;
    }

    if (user.role === UserRole.LEAD) {
      return ticket.assignedTeamId === user.teamId;
    }

    return (
      ticket.assignedTeamId === user.teamId &&
      (ticket.assigneeId === user.id || ticket.assigneeId === null)
    );
  }

  private canAssignTicket(
    user: AuthUser,
    ticket: { assignedTeamId: string | null; assigneeId: string | null },
    assigneeId?: string
  ) {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (!user.teamId || ticket.assignedTeamId !== user.teamId) {
      return false;
    }

    if (user.role === UserRole.LEAD) {
      return true;
    }

    const isSelfAssign = !assigneeId || assigneeId === user.id;

    if (!isSelfAssign) {
      return false;
    }

    return ticket.assigneeId === null || ticket.assigneeId === user.id;
  }

  private isValidTransition(from: TicketStatus, to: TicketStatus) {
    if (from === to) {
      return true;
    }

    const allowed: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.NEW]: [
        TicketStatus.TRIAGED,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.WAITING_ON_REQUESTER,
        TicketStatus.WAITING_ON_VENDOR,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.TRIAGED]: [
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.WAITING_ON_REQUESTER,
        TicketStatus.WAITING_ON_VENDOR,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.ASSIGNED]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.WAITING_ON_REQUESTER,
        TicketStatus.WAITING_ON_VENDOR,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.IN_PROGRESS]: [
        TicketStatus.WAITING_ON_REQUESTER,
        TicketStatus.WAITING_ON_VENDOR,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.WAITING_ON_REQUESTER]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.WAITING_ON_VENDOR]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ],
      [TicketStatus.RESOLVED]: [TicketStatus.REOPENED, TicketStatus.CLOSED],
      [TicketStatus.CLOSED]: [TicketStatus.REOPENED],
      [TicketStatus.REOPENED]: [
        TicketStatus.TRIAGED,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.WAITING_ON_REQUESTER,
        TicketStatus.WAITING_ON_VENDOR,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED
      ]
    };

    return allowed[from].includes(to);
  }

  private async routeTeam(subject: string, description: string) {
    const text = `${subject} ${description}`.toLowerCase();
    const rules = await this.prisma.routingRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }]
    });

    for (const rule of rules) {
      const matches = rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
      if (matches) {
        return rule.teamId;
      }
    }

    let slug: string | null = null;

    if (text.includes('hr') || text.includes('onboard') || text.includes('benefits')) {
      slug = 'hr-operations';
    } else if (text.includes('vpn') || text.includes('laptop') || text.includes('device') || text.includes('it ')) {
      slug = 'it-service-desk';
    }

    if (!slug) {
      return null;
    }

    const team = await this.prisma.team.findUnique({ where: { slug } });
    return team?.id ?? null;
  }
}
