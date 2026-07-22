import type { AuditAction, AuditEntityType, Prisma } from '@prisma/client';

import type { AuditActor, AuditActorSnapshot, AuditCategory, AuditRequestContext } from '@/lib/audit-log/contracts';
import { sanitizeAuditPayload } from '@/lib/audit-log/payload';
import { getAuditExpiry } from '@/lib/audit-log/retention';
import { prisma } from '@/lib/prisma';

export { auditAnonymousActor, auditSystemActor, auditUserActor } from '@/lib/audit-log/contracts';

type AuditWriter = Prisma.TransactionClient | typeof prisma;

type AuditPayloadAllowlists = {
  oldValue?: readonly string[];
  newValue?: readonly string[];
  metadata?: readonly string[];
};

export type AuditLogInput = {
  actor: AuditActor;
  companyId?: string | null;
  changeRequestId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string | null;
  action: AuditAction;
  category: AuditCategory;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  allowedFields: AuditPayloadAllowlists;
  requestContext?: AuditRequestContext;
  createdAt?: Date;
};

function boundedText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export function normalizeAuditIp(value: string | null | undefined) {
  const candidate = value?.split(',')[0]?.trim();
  if (!candidate || candidate.length > 64 || !/^[0-9a-f:.]+$/i.test(candidate)) return null;
  return candidate;
}

export function normalizeAuditUserAgent(value: string | null | undefined) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 512) : null;
}

export async function resolveAuditActor(writer: AuditWriter, actor: AuditActor): Promise<AuditActorSnapshot> {
  if (actor.type === 'ANONYMOUS') {
    return { actorId: null, actorName: null, actorEmail: null, actorRole: null };
  }

  if (actor.type === 'SYSTEM') {
    return {
      actorId: null,
      actorName: boundedText(actor.name, 200) ?? 'System',
      actorEmail: null,
      actorRole: null
    };
  }

  const user = await writer.user.findUnique({
    where: { id: actor.id },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user) {
    return { actorId: null, actorName: null, actorEmail: null, actorRole: null };
  }

  return {
    actorId: user.id,
    actorName: boundedText(user.name, 200),
    actorEmail: boundedText(user.email?.toLowerCase(), 320),
    actorRole: user.role
  };
}

export async function writeAuditLog(writer: AuditWriter, input: AuditLogInput) {
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const actor = await resolveAuditActor(writer, input.actor);
  const oldValue = sanitizeAuditPayload(input.oldValue, input.allowedFields.oldValue ?? []);
  const newValue = sanitizeAuditPayload(input.newValue, input.allowedFields.newValue ?? []);
  const metadata = sanitizeAuditPayload(input.metadata, input.allowedFields.metadata ?? []);

  return writer.auditLog.create({
    data: {
      ...actor,
      companyId: input.companyId || null,
      changeRequestId: input.changeRequestId || null,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: boundedText(input.entityLabel, 240),
      action: input.action,
      category: input.category,
      oldValue: oldValue as Prisma.InputJsonValue | undefined,
      newValue: newValue as Prisma.InputJsonValue | undefined,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      ipAddress: normalizeAuditIp(input.requestContext?.ipAddress),
      userAgent: normalizeAuditUserAgent(input.requestContext?.userAgent),
      createdAt,
      expiresAt: getAuditExpiry(input.category, createdAt)
    }
  });
}

export async function createChangeRequestAuditLog(
  writer: AuditWriter,
  input: Omit<AuditLogInput, 'entityType'>
) {
  return writeAuditLog(writer, { ...input, entityType: 'CHANGE_REQUEST' });
}

export async function listAuditLogsForAdmin() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: auditLogInclude
  });
}

export const auditLogInclude = {
  actor: { select: { id: true, name: true, email: true, role: true } },
  company: { select: { id: true, name: true, edrpou: true } },
  changeRequest: { select: { id: true, entityType: true, entityId: true, action: true, fieldName: true, status: true } }
} satisfies Prisma.AuditLogInclude;
