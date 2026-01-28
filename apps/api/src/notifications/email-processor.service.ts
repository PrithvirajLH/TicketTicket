import { Injectable } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { OutboxService } from './outbox.service';

@Injectable()
export class EmailProcessorService {
  constructor(
    private readonly outbox: OutboxService,
    private readonly email: EmailService,
  ) {}

  async process(outboxId: string) {
    const record = await this.outbox.findById(outboxId);
    if (!record) {
      return;
    }

    if (record.status === OutboxStatus.SENT) {
      return;
    }

    await this.outbox.markProcessing(outboxId);

    if (!this.email.isConfigured()) {
      await this.outbox.markFailed(outboxId, 'SMTP not configured');
      return;
    }

    try {
      await this.email.sendEmail({
        to: record.toEmail,
        subject: record.subject,
        text: record.body,
      });
      await this.outbox.markSent(outboxId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.outbox.markFailed(outboxId, message);
      throw error;
    }
  }
}
