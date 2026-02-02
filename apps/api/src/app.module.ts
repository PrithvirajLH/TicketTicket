import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoutingRulesModule } from './routing/routing.module';
import { SavedViewsModule } from './saved-views/saved-views.module';
import { SlasModule } from './slas/slas.module';
import { TeamsModule } from './teams/teams.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

// Resolve env file from cwd (apps/api) to work in both dev and production builds
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), envFile),
    }),
    AuthModule,
    CategoriesModule,
    NotificationsModule,
    PrismaModule,
    RoutingRulesModule,
    SavedViewsModule,
    SlasModule,
    TeamsModule,
    TicketsModule,
    UsersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
