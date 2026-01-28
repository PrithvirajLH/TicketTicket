import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SlasController } from './slas.controller';
import { SlasService } from './slas.service';

@Module({
  imports: [PrismaModule],
  controllers: [SlasController],
  providers: [SlasService],
})
export class SlasModule {}
