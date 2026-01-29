import { Injectable } from '@nestjs/common';
import type { Prisma, SlaInstance } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Database client type that works for both PrismaService and TransactionClient
type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SlaEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sync SLA instance from ticket data.
   * @param ticketId - The ticket ID to sync
   * @param options - Optional settings for policyId and reset flags
   * @param tx - Optional transaction client; if provided, all queries use this client
   */
  async syncFromTicket(
    ticketId: string,
    options?: {
      policyId?: string | null;
      resetResolution?: boolean;
      resetFirstResponse?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ) {
    // Use provided transaction client or default to this.prisma
    const db: DbClient = tx ?? this.prisma;

    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        priority: true,
        firstResponseDueAt: true,
        dueAt: true,
        slaPausedAt: true,
        firstResponseAt: true,
        completedAt: true,
        assignedTeamId: true,
      },
    });

    if (!ticket) {
      return null;
    }

    const existing = await db.slaInstance.findUnique({
      where: { ticketId },
    });

    // Derive policyId when not explicitly provided and no existing instance
    // This ensures pre-migration tickets get properly tracked
    let resolvedPolicyId = options?.policyId;
    if (resolvedPolicyId === undefined && !existing?.policyId && ticket.assignedTeamId) {
      const policy = await db.slaPolicy.findUnique({
        where: {
          teamId_priority: {
            teamId: ticket.assignedTeamId,
            priority: ticket.priority,
          },
        },
      });
      resolvedPolicyId = policy?.id ?? null;
    }

    // Apply resets before computing nextDueAt so reopened tickets get re-scheduled
    const effective = {
      firstResponseBreachedAt: options?.resetFirstResponse
        ? null
        : existing?.firstResponseBreachedAt ?? null,
      resolutionBreachedAt: options?.resetResolution
        ? null
        : existing?.resolutionBreachedAt ?? null,
    };

    const nextDueAt = this.computeNextDueAt(ticket, effective as SlaInstance | null);

    const updateData: Prisma.SlaInstanceUpdateInput = {
      priority: ticket.priority,
      firstResponseDueAt: ticket.firstResponseDueAt,
      resolutionDueAt: ticket.dueAt,
      pausedAt: ticket.slaPausedAt,
      nextDueAt,
    };

    if (resolvedPolicyId !== undefined) {
      if (resolvedPolicyId) {
        updateData.policy = { connect: { id: resolvedPolicyId } };
      } else if (existing?.policyId) {
        updateData.policy = { disconnect: true };
      }
    }

    if (options?.resetResolution) {
      updateData.resolutionBreachedAt = null;
      updateData.resolutionAtRiskNotifiedAt = null;
    }

    if (options?.resetFirstResponse) {
      updateData.firstResponseBreachedAt = null;
      updateData.firstResponseAtRiskNotifiedAt = null;
    }

    // Use existing policyId if we didn't resolve a new one and one exists
    const createPolicyId = resolvedPolicyId ?? existing?.policyId ?? null;

    return db.slaInstance.upsert({
      where: { ticketId },
      update: updateData,
      create: {
        ticketId,
        policyId: createPolicyId,
        priority: ticket.priority,
        firstResponseDueAt: ticket.firstResponseDueAt,
        resolutionDueAt: ticket.dueAt,
        pausedAt: ticket.slaPausedAt,
        nextDueAt,
      },
    });
  }

  private computeNextDueAt(
    ticket: {
      firstResponseAt: Date | null;
      completedAt: Date | null;
      firstResponseDueAt: Date | null;
      dueAt: Date | null;
      slaPausedAt: Date | null;
    },
    instance: SlaInstance | null,
  ) {
    if (ticket.slaPausedAt) {
      return null;
    }

    const firstResponsePending =
      !ticket.firstResponseAt && !instance?.firstResponseBreachedAt;
    if (firstResponsePending && ticket.firstResponseDueAt) {
      return ticket.firstResponseDueAt;
    }

    const resolutionPending =
      !ticket.completedAt && !instance?.resolutionBreachedAt;
    if (resolutionPending && ticket.dueAt) {
      return ticket.dueAt;
    }

    return null;
  }
}
