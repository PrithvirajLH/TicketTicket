import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { ListCustomFieldsDto } from './dto/list-custom-fields.dto';
import { SetTicketCustomValuesDto } from './dto/set-ticket-custom-values.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';

type CustomFieldWithOptions = {
  id: string;
  name: string;
  fieldType: string;
  options: unknown;
  isRequired: boolean;
  teamId: string | null;
  categoryId: string | null;
};

function parseOptions(raw: unknown): { value: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (item && typeof item === 'object' && 'value' in item) {
      const v = (item as { value: unknown }).value;
      const l = (item as { label?: unknown }).label;
      return { value: String(v ?? ''), label: String(l ?? v ?? '') };
    }
    const s = String(item);
    return { value: s, label: s };
  });
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureOwner(user: AuthUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Owner access required');
    }
  }

  private ensureTeamAdminOrOwner(user: AuthUser, teamId: string | null) {
    if (teamId == null) {
      this.ensureOwner(user);
      return;
    }
    if (user.role === UserRole.OWNER) return;
    if (user.role === UserRole.TEAM_ADMIN && user.primaryTeamId === teamId) return;
    throw new ForbiddenException('Team admin or owner access required');
  }

  async list(query: ListCustomFieldsDto, user: AuthUser) {
    if (user.role === UserRole.TEAM_ADMIN && !user.primaryTeamId) {
      throw new ForbiddenException('Team administrator must have a primary team set');
    }

    type Where = { teamId?: string | null; categoryId?: string | null; OR?: { teamId: string | null }[] };
    const where: Where = {};

    if (user.role === UserRole.OWNER || user.role === UserRole.TEAM_ADMIN) {
      const allowedTeamId = user.role === UserRole.TEAM_ADMIN ? user.primaryTeamId! : null;
      if (user.role === UserRole.OWNER) {
        if (query.teamId != null) where.teamId = query.teamId;
      } else {
        if (query.teamId != null && query.teamId !== allowedTeamId) {
          throw new ForbiddenException(
            'You can only list custom fields for your primary team',
          );
        }
        where.OR = [{ teamId: null }, { teamId: allowedTeamId }];
      }
      if (query.categoryId != null) where.categoryId = query.categoryId;
    } else {
      const allowedTeamId = user.teamId ?? null;
      if (query.teamId != null && query.teamId !== allowedTeamId) {
        throw new ForbiddenException(
          'You can only list custom fields for your own team',
        );
      }
      where.OR = [{ teamId: null }, { teamId: allowedTeamId }];
      if (query.categoryId != null) where.categoryId = query.categoryId;
    }

    const data = await this.prisma.customField.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { data };
  }

  async create(dto: CreateCustomFieldDto, user: AuthUser) {
    this.ensureTeamAdminOrOwner(user, dto.teamId ?? null);

    return this.prisma.customField.create({
      data: {
        name: dto.name,
        fieldType: dto.fieldType,
        options: dto.options ?? undefined,
        isRequired: dto.isRequired ?? false,
        teamId: dto.teamId ?? null,
        categoryId: dto.categoryId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCustomFieldDto, user: AuthUser) {
    const existing = await this.prisma.customField.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Custom field not found');
    }
    this.ensureTeamAdminOrOwner(user, existing.teamId);

    const data: Prisma.CustomFieldUpdateInput = {
      ...(dto.name != null && { name: dto.name }),
      ...(dto.fieldType != null && { fieldType: dto.fieldType }),
      ...(dto.options !== undefined && {
        options: dto.options === null ? Prisma.JsonNull : (dto.options as Prisma.InputJsonValue),
      }),
      ...(dto.isRequired != null && { isRequired: dto.isRequired }),
      ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
    };
    if (dto.teamId !== undefined) {
      data.team = dto.teamId == null ? { disconnect: true } : { connect: { id: dto.teamId } };
    }
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId == null ? { disconnect: true } : { connect: { id: dto.categoryId } };
    }
    return this.prisma.customField.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, user: AuthUser) {
    const existing = await this.prisma.customField.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Custom field not found');
    }
    this.ensureTeamAdminOrOwner(user, existing.teamId);

    await this.prisma.customField.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Validates and normalizes custom field values for a ticket.
   * - When requireAllRequired: true, ensures every required field for (teamId, categoryId) is present with non-empty value.
   * - Dedupes by customFieldId (keeps last).
   * - Ensures each custom field exists and belongs to the ticket's team/category.
   * - Enforces required fields have non-empty value.
   * - Validates/coerces value by fieldType.
   * @param options.requireAllRequired - When true (e.g. ticket create), load all applicable fields and reject if any required is missing.
   * @param options.tx - When provided, run all reads inside this transaction (avoids TOCTOU).
   */
  async validateAndNormalizeValuesForTicket(
    items: { customFieldId: string; value?: string | null }[],
    teamId: string | null,
    categoryId: string | null,
    options?: { requireAllRequired?: boolean; tx?: Prisma.TransactionClient },
  ): Promise<{ customFieldId: string; value: string | null }[]> {
    const client = options?.tx ?? this.prisma;

    const deduped = new Map<string, string | null>();
    for (const item of items ?? []) {
      deduped.set(item.customFieldId, item.value ?? null);
    }

    if (options?.requireAllRequired) {
      const applicableWhere = {
        AND: [
          { OR: [{ teamId: null }, { teamId }] },
          { OR: [{ categoryId: null }, { categoryId }] },
        ],
      };
      const applicableFields = await client.customField.findMany({
        where: applicableWhere,
      });
      for (const field of applicableFields) {
        if (!field.isRequired) continue;
        const raw = deduped.get(field.id);
        const value = raw == null ? null : String(raw).trim();
        if (value === null || value === '') {
          throw new BadRequestException(
            `Required custom field "${field.name}" must be provided`,
          );
        }
      }
    }

    if (deduped.size === 0) return [];

    const ids = [...deduped.keys()];
    const fields = await client.customField.findMany({
      where: { id: { in: ids } },
    });
    const fieldMap = new Map(fields.map((f) => [f.id, f]));

    const result: { customFieldId: string; value: string | null }[] = [];
    for (const [customFieldId, rawValue] of deduped) {
      const field = fieldMap.get(customFieldId);
      if (!field) {
        throw new BadRequestException(`Unknown custom field: ${customFieldId}`);
      }
      if (field.teamId != null && field.teamId !== teamId) {
        throw new ForbiddenException(
          `Custom field "${field.name}" does not apply to this ticket's team`,
        );
      }
      if (field.categoryId != null) {
        if (categoryId === null) {
          throw new BadRequestException(
            `Category-scoped custom field "${field.name}" requires the ticket to have a category set`,
          );
        }
        if (field.categoryId !== categoryId) {
          throw new ForbiddenException(
            `Custom field "${field.name}" does not apply to this ticket's category`,
          );
        }
      }
      const value = rawValue == null ? null : String(rawValue).trim();
      if (field.isRequired && (value === null || value === '')) {
        throw new BadRequestException(
          `Required custom field "${field.name}" must have a value`,
        );
      }
      const normalized = this.normalizeValueByFieldType(
        field as CustomFieldWithOptions,
        value,
      );
      result.push({ customFieldId, value: normalized });
    }
    return result;
  }

  private normalizeValueByFieldType(
    field: CustomFieldWithOptions,
    value: string | null,
  ): string | null {
    if (value === null || value === '') return null;
    switch (field.fieldType) {
      case 'NUMBER': {
        const n = Number(value);
        if (Number.isNaN(n)) {
          throw new BadRequestException(
            `Custom field "${field.name}" must be a number`,
          );
        }
        return String(n);
      }
      case 'DATE': {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException(
            `Custom field "${field.name}" must be a valid date`,
          );
        }
        return d.toISOString().slice(0, 10);
      }
      case 'CHECKBOX':
        return value === 'true' || value === '1' || value.toLowerCase() === 'yes' ? 'true' : 'false';
      case 'DROPDOWN': {
        const options = parseOptions(field.options);
        const allowed = new Set(options.map((o) => o.value));
        if (!allowed.has(value)) {
          throw new BadRequestException(
            `Custom field "${field.name}" value is not in allowed options`,
          );
        }
        return value;
      }
      case 'USER':
        return value;
      case 'MULTISELECT': {
        const options = parseOptions(field.options);
        const allowed = new Set(options.map((o) => o.value));
        const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
        for (const p of parts) {
          if (!allowed.has(p)) {
            throw new BadRequestException(
              `Custom field "${field.name}" value "${p}" is not in allowed options`,
            );
          }
        }
        return parts.join(',');
      }
      default:
        return value;
    }
  }

  async setTicketValues(
    ticketId: string,
    payload: SetTicketCustomValuesDto,
    user: AuthUser,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { accessGrants: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const canWrite =
      user.role === UserRole.OWNER ||
      (user.role === UserRole.TEAM_ADMIN &&
        user.primaryTeamId &&
        ticket.assignedTeamId === user.primaryTeamId) ||
      user.role === UserRole.LEAD ||
      (user.role === UserRole.AGENT &&
        (ticket.assignedTeamId === user.teamId ||
          ticket.accessGrants?.some((g) => g.teamId === user.teamId)));
    if (!canWrite) {
      throw new ForbiddenException('No write access to this ticket');
    }

    await this.prisma.$transaction(async (tx) => {
      const validated = await this.validateAndNormalizeValuesForTicket(
        payload.values,
        ticket.assignedTeamId,
        ticket.categoryId,
        { tx },
      );
      for (const item of validated) {
        await tx.customFieldValue.upsert({
          where: {
            ticketId_customFieldId: { ticketId, customFieldId: item.customFieldId },
          },
          create: {
            ticketId,
            customFieldId: item.customFieldId,
            value: item.value,
          },
          update: { value: item.value },
        });
      }
    });

    return this.prisma.customFieldValue.findMany({
      where: { ticketId },
      include: { customField: true },
    });
  }
}
