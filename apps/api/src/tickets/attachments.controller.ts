import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { TicketsService } from './tickets.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':id')
  async download(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const { attachment, stream } = await this.ticketsService.getAttachmentFile(
      id,
      user,
    );
    const safeName = attachment.fileName.replace(/"/g, '');
    return new StreamableFile(stream, {
      type: attachment.contentType,
      disposition: `attachment; filename="${safeName}"`,
      length: attachment.sizeBytes,
    });
  }
}
