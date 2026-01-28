import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailProcessorService } from './email-processor.service';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [ConfigModule],
  providers: [
    NotificationsService,
    OutboxService,
    EmailService,
    EmailProcessorService,
    EmailQueueService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
