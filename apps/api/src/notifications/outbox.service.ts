import { Injectable } from '@nestjs/common';
import { NotificationChannel, OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async createEmail(payload: {
    toEmail: string;
    toUserId?: string | null;
    ticketId?: string | null;
    subject: string;
    body: string;
    eventType: string;
    payload?: Prisma.InputJsonValue | null;
  }) {
    return this.prisma.notificationOutbox.create({
      data: {
        channel: NotificationChannel.EMAIL,
        status: OutboxStatus.PENDING,
        eventType: payload.eventType,
        toEmail: payload.toEmail,
        toUserId: payload.toUserId ?? null,
        ticketId: payload.ticketId ?? null,
        subject: payload.subject,
        body: payload.body,
        payload: payload.payload ?? undefined,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.notificationOutbox.findUnique({ where: { id } });
  }

  async markProcessing(id: string) {
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });
  }

  async markSent(id: string) {
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: OutboxStatus.SENT,
        sentAt: new Date(),
        lastError: null,
      },
    });
  }

  async markFailed(id: string, error: string) {
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: OutboxStatus.FAILED,
        lastError: error,
      },
    });
  }
}
