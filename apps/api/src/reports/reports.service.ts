import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, TicketPriority, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReportQueryDto,
  ResolutionTimeQueryDto,
} from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** For TEAM_ADMIN, force teamId to primary team and ignore other teamId. */
  private scopeReportQuery(query: ReportQueryDto, user: AuthUser): ReportQueryDto {
    if (user.role === UserRole.TEAM_ADMIN) {
      if (!user.primaryTeamId) {
        throw new ForbiddenException('Team administrator must have a primary team set');
      }
      return { ...query, teamId: user.primaryTeamId };
    }
    return query;
  }

  /** For date-only "to" values (YYYY-MM-DD), return next day 00:00 UTC so lt includes the whole selected day. */
  private toEndExclusive(to?: string): Date {
    if (!to) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const d = new Date(`${to}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
    }
    return new Date(to);
  }

  /** Base where and date range for reports (admin-only; no access filter). */
  private reportWhere(
    query: ReportQueryDto,
    fromDate: Date,
    toEndExclusive: Date,
  ): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {
      createdAt: { gte: fromDate, lt: toEndExclusive },
    };
    if (query.teamId) where.assignedTeamId = query.teamId;
    if (query.priority) where.priority = query.priority;
    if (query.categoryId) where.categoryId = query.categoryId;
    return where;
  }

  private dateRange(from?: string, to?: string): { fromDate: Date; toEndExclusive: Date; toDateInclusive: Date } {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const fromDate = from ? new Date(from) : defaultFrom;
    const toEndExclusive = this.toEndExclusive(to);
    const toDateInclusive = to ? new Date(to) : now;
    return { fromDate, toEndExclusive, toDateInclusive };
  }

  /** Build raw SQL conditions for date + optional filters (parameterized). End is exclusive (lt). Use tableAlias (e.g. 't') when query joins multiple tables that have these columns. */
  private rawConditions(
    fromDate: Date,
    toEndExclusive: Date,
    teamId?: string,
    priority?: TicketPriority,
    categoryId?: string,
    tableAlias?: string,
  ): Prisma.Sql[] {
    const pre = tableAlias ? `${tableAlias}."` : '"';
    const conditions: Prisma.Sql[] = [
      Prisma.sql`${Prisma.raw(pre + 'createdAt"')} >= ${fromDate}`,
      Prisma.sql`${Prisma.raw(pre + 'createdAt"')} < ${toEndExclusive}`,
    ];
    if (teamId) conditions.push(Prisma.sql`${Prisma.raw(pre + 'assignedTeamId"')} = ${teamId}`);
    if (priority) conditions.push(Prisma.sql`${Prisma.raw(pre + 'priority"')} = ${priority}`);
    if (categoryId) conditions.push(Prisma.sql`${Prisma.raw(pre + 'categoryId"')} = ${categoryId}`);
    return conditions;
  }

  async getTicketVolume(query: ReportQueryDto, user: AuthUser) {
    const scoped = this.scopeReportQuery(query, user);
    const { fromDate, toEndExclusive, toDateInclusive } = this.dateRange(scoped.from, scoped.to);
    const conditions = this.rawConditions(
      fromDate,
      toEndExclusive,
      scoped.teamId,
      scoped.priority,
      scoped.categoryId,
    );
    const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT d::date as date, coalesce(c.cnt, 0)::bigint as count
      FROM generate_series(${fromDate}::date, ${toDateInclusive}::date, '1 day'::interval) d
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt")::date as day, count(*)::bigint as cnt
        FROM "Ticket"
        WHERE ${Prisma.join(conditions, ' AND ')}
        GROUP BY 1
      ) c ON c.day = d::date
      ORDER BY 1
    `;
    return {
      data: rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        count: Number(r.count),
      })),
    };
  }

  async getSlaCompliance(query: ReportQueryDto, user: AuthUser) {
    const scoped = this.scopeReportQuery(query, user);
    const { fromDate, toEndExclusive } = this.dateRange(scoped.from, scoped.to);
    const conditions = this.rawConditions(
      fromDate,
      toEndExclusive,
      scoped.teamId,
      scoped.priority,
      scoped.categoryId,
    );
    conditions.push(Prisma.sql`("firstResponseDueAt" IS NOT NULL OR "dueAt" IS NOT NULL)`);
    const row = await this.prisma.$queryRaw<
      {
        first_response_met: bigint;
        first_response_breached: bigint;
        resolution_met: bigint;
        resolution_breached: bigint;
      }[]
    >`
      SELECT
        count(*) FILTER (WHERE "firstResponseDueAt" IS NOT NULL AND "firstResponseAt" IS NOT NULL AND "firstResponseAt" <= "firstResponseDueAt")::bigint as first_response_met,
        count(*) FILTER (WHERE "firstResponseDueAt" IS NOT NULL AND (
          ("firstResponseAt" IS NOT NULL AND "firstResponseAt" > "firstResponseDueAt") OR
          ("firstResponseAt" IS NULL AND now() > "firstResponseDueAt")
        ))::bigint as first_response_breached,
        count(*) FILTER (WHERE "dueAt" IS NOT NULL AND "resolvedAt" IS NOT NULL AND "resolvedAt" <= "dueAt")::bigint as resolution_met,
        count(*) FILTER (WHERE "dueAt" IS NOT NULL AND (
          ("resolvedAt" IS NOT NULL AND "resolvedAt" > "dueAt") OR
          ("resolvedAt" IS NULL AND now() > "dueAt")
        ))::bigint as resolution_breached
      FROM "Ticket"
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
    const r = row[0];
    const firstResponseMet = Number(r?.first_response_met ?? 0);
    const firstResponseBreached = Number(r?.first_response_breached ?? 0);
    const resolutionMet = Number(r?.resolution_met ?? 0);
    const resolutionBreached = Number(r?.resolution_breached ?? 0);
    const total = firstResponseMet + firstResponseBreached + resolutionMet + resolutionBreached;
    return {
      data: {
        met: firstResponseMet + resolutionMet,
        breached: firstResponseBreached + resolutionBreached,
        total,
        firstResponseMet,
        firstResponseBreached,
        resolutionMet,
        resolutionBreached,
      },
    };
  }

  async getResolutionTime(query: ResolutionTimeQueryDto, user: AuthUser) {
    const scoped = this.scopeReportQuery(query, user);
    const { fromDate, toEndExclusive } = this.dateRange(scoped.from, scoped.to);
    const conditions = this.rawConditions(
      fromDate,
      toEndExclusive,
      scoped.teamId,
      scoped.priority,
      scoped.categoryId,
    );
    conditions.push(Prisma.sql`"resolvedAt" IS NOT NULL`);
    const groupBy = query.groupBy === 'priority' ? 'priority' : 'team';

    if (groupBy === 'priority') {
      const rows = await this.prisma.$queryRaw<
        { priority: string; avg_hours: number; count: bigint }[]
      >`
        SELECT "priority", round(avg(EXTRACT(epoch FROM ("resolvedAt" - "createdAt"))/3600)::numeric, 1)::float as avg_hours, count(*)::bigint as count
        FROM "Ticket"
        WHERE ${Prisma.join(conditions, ' AND ')}
        GROUP BY "priority"
        ORDER BY "priority"
      `;
      return {
        data: rows.map((r) => ({
          label: r.priority,
          avgHours: r.avg_hours,
          count: Number(r.count),
        })),
      };
    }

    const rows = await this.prisma.$queryRaw<
      { assigned_team_id: string | null; team_name: string | null; avg_hours: number; count: bigint }[]
    >`
      SELECT sub."assignedTeamId" as assigned_team_id, tm."name" as team_name,
        round(avg(EXTRACT(epoch FROM (sub."resolvedAt" - sub."createdAt"))/3600)::numeric, 1)::float as avg_hours,
        count(*)::bigint as count
      FROM (
        SELECT "assignedTeamId", "createdAt", "resolvedAt"
        FROM "Ticket"
        WHERE ${Prisma.join(conditions, ' AND ')}
      ) sub
      LEFT JOIN "Team" tm ON tm.id = sub."assignedTeamId"
      GROUP BY sub."assignedTeamId", tm."name"
      ORDER BY tm."name" NULLS LAST
    `;
    return {
      data: rows.map((r) => ({
        id: r.assigned_team_id ?? 'unassigned',
        label: r.team_name ?? 'Unassigned',
        avgHours: r.avg_hours,
        count: Number(r.count),
      })),
    };
  }

  async getTicketsByStatus(query: ReportQueryDto, user: AuthUser) {
    const scoped = this.scopeReportQuery(query, user);
    const { fromDate, toEndExclusive } = this.dateRange(scoped.from, scoped.to);
    const where = this.reportWhere(scoped, fromDate, toEndExclusive);
    const groups = await this.prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      orderBy: { status: 'asc' },
    });
    return {
      data: groups.map((g) => ({
        status: g.status,
        count: g._count.id,
      })),
    };
  }

  async getTicketsByPriority(query: ReportQueryDto, user: AuthUser) {
    const scoped = this.scopeReportQuery(query, user);
    const { fromDate, toEndExclusive } = this.dateRange(scoped.from, scoped.to);
    const where = this.reportWhere(scoped, fromDate, toEndExclusive);
    const groups = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where,
      _count: { id: true },
      orderBy: { priority: 'asc' },
    });
    return {
      data: groups.map((g) => ({
        priority: g.priority,
        count: g._count.id,
      })),
    };
  }

  async getAgentPerformance(query: ReportQueryDto, user: AuthUser) {
    const scoped = this.scopeReportQuery(query, user);
    const { fromDate, toEndExclusive } = this.dateRange(scoped.from, scoped.to);
    const conditions = this.rawConditions(
      fromDate,
      toEndExclusive,
      scoped.teamId,
      scoped.priority,
      scoped.categoryId,
      't',
    );
    conditions.push(Prisma.sql`t."assigneeId" IS NOT NULL`);
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        display_name: string | null;
        email: string;
        resolved: bigint;
        total_resolution_sec: number;
        first_responses: bigint;
        total_first_response_sec: number;
      }[]
    >`
      SELECT
        t."assigneeId" as user_id,
        u."displayName" as display_name,
        u."email" as email,
        count(*) FILTER (WHERE t."resolvedAt" IS NOT NULL)::bigint as resolved,
        coalesce(sum(EXTRACT(epoch FROM (t."resolvedAt" - t."createdAt"))) FILTER (WHERE t."resolvedAt" IS NOT NULL), 0)::float as total_resolution_sec,
        count(*) FILTER (WHERE t."firstResponseAt" IS NOT NULL)::bigint as first_responses,
        coalesce(sum(EXTRACT(epoch FROM (t."firstResponseAt" - t."createdAt"))) FILTER (WHERE t."firstResponseAt" IS NOT NULL), 0)::float as total_first_response_sec
      FROM "Ticket" t
      INNER JOIN "User" u ON u.id = t."assigneeId"
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY t."assigneeId", u."displayName", u."email"
      ORDER BY resolved DESC
    `;
    return {
      data: rows.map((r) => ({
        userId: r.user_id,
        name: r.display_name ?? r.email ?? 'Unknown',
        email: r.email,
        ticketsResolved: Number(r.resolved),
        avgResolutionHours:
          Number(r.resolved) > 0
            ? Math.round((r.total_resolution_sec / 3600 / Number(r.resolved)) * 10) / 10
            : null,
        firstResponses: Number(r.first_responses),
        avgFirstResponseHours:
          Number(r.first_responses) > 0
            ? Math.round(
                (r.total_first_response_sec / 3600 / Number(r.first_responses)) * 10,
              ) / 10
            : null,
      })),
    };
  }
}
