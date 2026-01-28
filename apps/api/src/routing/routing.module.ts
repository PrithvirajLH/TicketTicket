import { Module } from '@nestjs/common';
import { RoutingRulesController } from './routing.controller';
import { RoutingRulesService } from './routing.service';

@Module({
  controllers: [RoutingRulesController],
  providers: [RoutingRulesService],
})
export class RoutingRulesModule {}
