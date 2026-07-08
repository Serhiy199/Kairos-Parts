import type { AuditAction, AuditEntityType, Prisma } from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

export type AuditLogInput = {
  actorId?: string | null;
  companyId?: string | null;
  changeRequestId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

type AuditWriter = Prisma.TransactionClient | typeof prisma;

export async function createAuditLog(writer: AuditWriter, input: AuditLogInput) {
  return writer.auditLog.create({
    data: {
      actorId: input.actorId || null,
      companyId: input.companyId || null,
      changeRequestId: input.changeRequestId || null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldValue: input.oldValue,
      newValue: input.newValue,
      metadata: input.metadata
    }
  });
}

export async function createChangeRequestAuditLog(writer: AuditWriter, input: Omit<AuditLogInput, 'entityType'>) {
  return createAuditLog(writer, {
    ...input,
    entityType: 'CHANGE_REQUEST'
  });
}

export async function listAuditLogsForAdmin() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: auditLogInclude
  });
}

export async function listAuditLogsForCompanyOrClient(access: ClientAccessContext) {
  return prisma.auditLog.findMany({
    where: access.companyId
      ? { OR: [{ companyId: access.companyId }, { actorId: access.userId }] }
      : { actorId: access.userId, companyId: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: auditLogInclude
  });
}

export const auditLogInclude = {
  actor: { select: { id: true, name: true, email: true, role: true } },
  company: { select: { id: true, name: true, edrpou: true } },
  changeRequest: { select: { id: true, entityType: true, entityId: true, action: true, fieldName: true, status: true } }
} satisfies Prisma.AuditLogInclude;
