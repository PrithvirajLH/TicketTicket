import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCategoriesDto) {
    const where = {
      isActive: query.includeInactive ? undefined : true,
      parentId: query.parentId ?? undefined,
      name: query.q
        ? { contains: query.q, mode: 'insensitive' as const }
        : undefined,
    };

    const data = await this.prisma.category.findMany({
      where,
      include: { parent: true },
      orderBy: [{ name: 'asc' }],
    });

    return { data };
  }

  async create(payload: CreateCategoryDto, user: AuthUser) {
    this.ensureAdmin(user);

    if (payload.parentId) {
      await this.ensureCategory(payload.parentId);
    }

    const slug = payload.slug ?? this.slugify(payload.name);

    return this.prisma.category.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description,
        parentId: payload.parentId ?? null,
        isActive: payload.isActive ?? true,
      },
      include: { parent: true },
    });
  }

  async update(id: string, payload: UpdateCategoryDto, user: AuthUser) {
    this.ensureAdmin(user);

    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (payload.parentId) {
      await this.ensureCategory(payload.parentId);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        parentId: payload.parentId ?? undefined,
        isActive: payload.isActive,
      },
      include: { parent: true },
    });
  }

  async remove(id: string, user: AuthUser) {
    this.ensureAdmin(user);

    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const children = await this.prisma.category.count({
      where: { parentId: id },
    });
    if (children > 0) {
      throw new ForbiddenException('Category has subcategories');
    }

    await this.prisma.category.delete({ where: { id } });

    return { id };
  }

  private ensureAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private async ensureCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Parent category not found');
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
}
