import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlasModule } from '../slas/slas.module';
import { AttachmentsController } from './attachments.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [NotificationsModule, SlasModule],
  controllers: [TicketsController, AttachmentsController],
  providers: [TicketsService],
})
export class TicketsModule {}
