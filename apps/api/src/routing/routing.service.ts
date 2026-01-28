import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';

@Injectable()
export class RoutingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const data = await this.prisma.routingRule.findMany({
      include: { team: true },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });

    return { data };
  }

  async create(payload: CreateRoutingRuleDto, user: AuthUser) {
    this.ensureAdmin(user);

    const keywords = this.normalizeKeywords(payload.keywords);

    return this.prisma.routingRule.create({
      data: {
        name: payload.name,
        teamId: payload.teamId,
        keywords,
        priority: payload.priority ?? 100,
        isActive: payload.isActive ?? true,
      },
      include: { team: true },
    });
  }

  async update(id: string, payload: UpdateRoutingRuleDto, user: AuthUser) {
    this.ensureAdmin(user);

    const rule = await this.prisma.routingRule.findUnique({ where: { id } });

    if (!rule) {
      throw new NotFoundException('Routing rule not found');
    }

    return this.prisma.routingRule.update({
      where: { id },
      data: {
        name: payload.name,
        teamId: payload.teamId,
        keywords: payload.keywords
          ? this.normalizeKeywords(payload.keywords)
          : undefined,
        priority: payload.priority,
        isActive: payload.isActive,
      },
      include: { team: true },
    });
  }

  async remove(id: string, user: AuthUser) {
    this.ensureAdmin(user);

    const rule = await this.prisma.routingRule.findUnique({ where: { id } });

    if (!rule) {
      throw new NotFoundException('Routing rule not found');
    }

    await this.prisma.routingRule.delete({ where: { id } });

    return { id };
  }

  private ensureAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private normalizeKeywords(keywords: string[]) {
    return keywords
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0)
      .map((keyword) => keyword.toLowerCase());
  }
}
