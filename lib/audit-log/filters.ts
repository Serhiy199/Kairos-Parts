import type { AuditAction, AuditEntityType, AuditLogCategory, Prisma } from '@prisma/client';

import { AUDIT_ACTIONS, AUDIT_CATEGORIES, AUDIT_ENTITY_TYPES } from '@/lib/audit-log/contracts';

export const AUDIT_LOG_PAGE_SIZE = 25;
export const AUDIT_SEARCH_MAX_LENGTH = 120;

export type AuditLogSearchParams = Record<string, string | string[] | undefined>;

export type AuditLogFilters = {
  search: string;
  actorId: string | null;
  category: AuditLogCategory | null;
  entityType: AuditEntityType | null;
  action: AuditAction | null;
  dateFrom: string;
  dateTo: string;
  criticalOnly: boolean;
  page: number;
};

const categories = new Set<string>(Object.values(AUDIT_CATEGORIES));
const entityTypes = new Set<string>(Object.values(AUDIT_ENTITY_TYPES));
const actions = new Set<string>(Object.values(AUDIT_ACTIONS));

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bounded(value: string | string[] | undefined, maxLength: number) {
  return (firstValue(value) ?? '').trim().slice(0, maxLength);
}

function enumValue<T extends string>(value: string, allowed: Set<string>): T | null {
  return allowed.has(value) ? value as T : null;
}

function validDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? value
    : '';
}

function dateBoundary(value: string, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function parseAuditLogFilters(searchParams: AuditLogSearchParams): AuditLogFilters {
  const requestedPage = Number.parseInt(bounded(searchParams.page, 9), 10);

  return {
    search: bounded(searchParams.search, AUDIT_SEARCH_MAX_LENGTH),
    actorId: bounded(searchParams.actor, 64) || null,
    category: enumValue<AuditLogCategory>(bounded(searchParams.category, 40), categories),
    entityType: enumValue<AuditEntityType>(bounded(searchParams.entity, 60), entityTypes),
    action: enumValue<AuditAction>(bounded(searchParams.action, 80), actions),
    dateFrom: validDateInput(bounded(searchParams.from, 10)),
    dateTo: validDateInput(bounded(searchParams.to, 10)),
    criticalOnly: bounded(searchParams.critical, 8) === '1',
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  };
}

export function buildAuditLogWhere(
  filters: AuditLogFilters,
  fixedActorId?: string
): Prisma.AuditLogWhereInput {
  const conditions: Prisma.AuditLogWhereInput[] = [];
  const actorId = fixedActorId ?? filters.actorId;

  if (actorId) {
    conditions.push({ actorId });
  }

  if (filters.search) {
    const searchConditions: Prisma.AuditLogWhereInput[] = [
      { actorName: { contains: filters.search, mode: 'insensitive' } },
      { actorEmail: { contains: filters.search, mode: 'insensitive' } },
      { entityLabel: { contains: filters.search, mode: 'insensitive' } },
      { entityId: { contains: filters.search, mode: 'insensitive' } }
    ];
    const matchingAction = enumValue<AuditAction>(filters.search.toUpperCase(), actions);
    if (matchingAction) searchConditions.push({ action: matchingAction });

    conditions.push({
      OR: searchConditions
    });
  }

  if (filters.category) conditions.push({ category: filters.category });
  if (filters.entityType) conditions.push({ entityType: filters.entityType });
  if (filters.action) conditions.push({ action: filters.action });
  if (filters.criticalOnly) {
    conditions.push({ category: { in: ['FINANCIAL_CRITICAL', 'CRITICAL_READ'] } });
  }

  const from = dateBoundary(filters.dateFrom);
  const to = dateBoundary(filters.dateTo, true);
  if (from || to) {
    conditions.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {})
      }
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

export function auditLogQuery(filters: AuditLogFilters, overrides: Partial<AuditLogFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.search) params.set('search', next.search);
  if (next.actorId) params.set('actor', next.actorId);
  if (next.category) params.set('category', next.category);
  if (next.entityType) params.set('entity', next.entityType);
  if (next.action) params.set('action', next.action);
  if (next.dateFrom) params.set('from', next.dateFrom);
  if (next.dateTo) params.set('to', next.dateTo);
  if (next.criticalOnly) params.set('critical', '1');
  if (next.page > 1) params.set('page', String(next.page));

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function hasAuditLogFilters(filters: AuditLogFilters) {
  return Boolean(
    filters.search
    || filters.actorId
    || filters.category
    || filters.entityType
    || filters.action
    || filters.dateFrom
    || filters.dateTo
    || filters.criticalOnly
  );
}
