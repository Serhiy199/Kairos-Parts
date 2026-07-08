import { ChangeRequestStatus } from '@prisma/client';
import type { ChangeAction, ChangeEntityType, Prisma } from '@prisma/client';

import { createAuditLog, createChangeRequestAuditLog } from '@/lib/audit-log/service';
import type { ClientAccessContext } from '@/lib/client/access';
import { requestAccessWhere, vehicleAccessWhere } from '@/lib/client/access';
import { applyChangeRequest } from '@/lib/change-requests/apply';
import { prisma } from '@/lib/prisma';

type ChangeRequestInput = {
  entityType: ChangeEntityType;
  entityId: string;
  action: ChangeAction;
  fieldName: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason: string | null;
};

function clientChangeRequestWhere(access: ClientAccessContext): Prisma.ChangeRequestWhereInput {
  if (access.companyId) {
    return {
      OR: [
        { companyId: access.companyId },
        { requestedById: access.userId }
      ]
    };
  }

  return { requestedById: access.userId, companyId: null };
}

export async function ensureClientEntityAccess(access: ClientAccessContext, entityType: ChangeEntityType, entityId: string) {
  switch (entityType) {
    case 'REQUEST': {
      const count = await prisma.request.count({ where: { id: entityId, AND: [requestAccessWhere(access)] } });
      return count > 0;
    }
    case 'REQUEST_ITEM': {
      const count = await prisma.requestItem.count({ where: { id: entityId, request: requestAccessWhere(access) } });
      return count > 0;
    }
    case 'VEHICLE': {
      const count = await prisma.vehicle.count({ where: { id: entityId, AND: [vehicleAccessWhere(access)] } });
      return count > 0;
    }
    case 'REQUEST_DOCUMENT': {
      const count = await prisma.requestDocument.count({ where: { id: entityId, visibleToClient: true, request: requestAccessWhere(access) } });
      return count > 0;
    }
    case 'COMMERCIAL_OFFER': {
      const count = await prisma.commercialOffer.count({
        where: {
          id: entityId,
          status: { in: ['SENT', 'APPROVED', 'REJECTED'] },
          request: requestAccessWhere(access)
        }
      });
      return count > 0;
    }
    case 'COMPANY':
    case 'COMPANY_PROFILE':
      return Boolean(access.companyId && access.companyId === entityId);
    default:
      return false;
  }
}

export async function createChangeRequest(access: ClientAccessContext, input: ChangeRequestInput) {
  const canAccessEntity = await ensureClientEntityAccess(access, input.entityType, input.entityId);

  if (!canAccessEntity) {
    return { ok: false as const, status: 'entity-not-found-or-forbidden' };
  }

  const changeRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.changeRequest.create({
      data: {
        companyId: access.companyId,
        requestedById: access.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        status: 'PENDING',
        fieldName: input.fieldName,
        oldValue: input.oldValue,
        newValue: input.newValue,
        reason: input.reason
      },
      include: changeRequestInclude
    });

    await createChangeRequestAuditLog(tx, {
      actorId: access.userId,
      companyId: access.companyId,
      changeRequestId: created.id,
      entityId: created.id,
      action: 'CHANGE_REQUEST_CREATED',
      oldValue: input.oldValue,
      newValue: input.newValue,
      metadata: {
        entityType: input.entityType,
        originalEntityId: input.entityId,
        action: input.action,
        fieldName: input.fieldName,
        reason: input.reason
      }
    });

    return created;
  });

  return { ok: true as const, changeRequest };
}

export async function listChangeRequestsForClient(access: ClientAccessContext) {
  return prisma.changeRequest.findMany({
    where: clientChangeRequestWhere(access),
    orderBy: { createdAt: 'desc' },
    include: changeRequestInclude
  });
}

export async function listChangeRequestsForAdmin() {
  return prisma.changeRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: changeRequestInclude
  });
}

export async function getChangeRequestForAdmin(id: string) {
  return prisma.changeRequest.findUnique({
    where: { id },
    include: changeRequestInclude
  });
}

export async function cancelOwnPendingChangeRequest(access: ClientAccessContext, id: string) {
  const changeRequest = await prisma.changeRequest.findFirst({
    where: { id, requestedById: access.userId, status: 'PENDING' },
    select: { id: true }
  });

  if (!changeRequest) {
    return { ok: false as const, status: 'change-request-not-found-or-not-pending' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.changeRequest.update({
      where: { id: changeRequest.id },
      data: { status: 'CANCELLED' },
      include: changeRequestInclude
    });

    await createChangeRequestAuditLog(tx, {
      actorId: access.userId,
      companyId: cancelled.companyId,
      changeRequestId: cancelled.id,
      entityId: cancelled.id,
      action: 'CHANGE_REQUEST_CANCELLED',
      oldValue: cancelled.oldValue ?? undefined,
      newValue: cancelled.newValue ?? undefined,
      metadata: {
        entityType: cancelled.entityType,
        originalEntityId: cancelled.entityId,
        action: cancelled.action,
        fieldName: cancelled.fieldName,
        reason: cancelled.reason
      }
    });

    return cancelled;
  });

  return { ok: true as const, changeRequest: updated };
}

export async function approveChangeRequest(id: string, reviewedById: string, adminComment: string | null) {
  const result = await prisma.$transaction(async (tx) => {
    const changeRequest = await tx.changeRequest.findFirst({
      where: { id, status: 'PENDING' }
    });

    if (!changeRequest) {
      return { ok: false as const, status: 'change-request-not-found-or-not-pending' };
    }

    const applyResult = await applyChangeRequest(tx, changeRequest, reviewedById);

    if (!applyResult.ok) {
      return applyResult;
    }

    const updated = await tx.changeRequest.update({
      where: { id: changeRequest.id },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewedAt: new Date(),
        adminComment
      },
      include: changeRequestInclude
    });

    await createChangeRequestAuditLog(tx, {
      actorId: reviewedById,
      companyId: changeRequest.companyId,
      changeRequestId: changeRequest.id,
      entityId: changeRequest.id,
      action: 'CHANGE_REQUEST_APPROVED',
      oldValue: changeRequest.oldValue ?? undefined,
      newValue: changeRequest.newValue ?? undefined,
      metadata: {
        adminComment,
        entityType: changeRequest.entityType,
        originalEntityId: changeRequest.entityId,
        action: changeRequest.action,
        fieldName: changeRequest.fieldName,
        reason: changeRequest.reason
      }
    });

    await createAuditLog(tx, {
      actorId: reviewedById,
      companyId: changeRequest.companyId,
      changeRequestId: changeRequest.id,
      entityType: applyResult.audit.entityType,
      entityId: applyResult.audit.entityId,
      action: applyResult.audit.action,
      oldValue: applyResult.audit.oldValue,
      newValue: applyResult.audit.newValue,
      metadata: applyResult.audit.metadata
    });

    return { ok: true as const, changeRequest: updated };
  });

  return result;
}

export async function rejectChangeRequest(id: string, reviewedById: string, adminComment: string | null) {
  return reviewPendingChangeRequest(id, reviewedById, 'REJECTED', adminComment);
}

async function reviewPendingChangeRequest(id: string, reviewedById: string, status: Extract<ChangeRequestStatus, 'APPROVED' | 'REJECTED'>, adminComment: string | null) {
  const changeRequest = await prisma.changeRequest.findFirst({
    where: { id, status: 'PENDING' },
    select: { id: true }
  });

  if (!changeRequest) {
    return { ok: false as const, status: 'change-request-not-found-or-not-pending' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reviewed = await tx.changeRequest.update({
      where: { id: changeRequest.id },
      data: {
        status,
        reviewedById,
        reviewedAt: new Date(),
        adminComment
      },
      include: changeRequestInclude
    });

    await createChangeRequestAuditLog(tx, {
      actorId: reviewedById,
      companyId: reviewed.companyId,
      changeRequestId: reviewed.id,
      entityId: reviewed.id,
      action: status === 'REJECTED' ? 'CHANGE_REQUEST_REJECTED' : 'CHANGE_REQUEST_APPROVED',
      oldValue: reviewed.oldValue ?? undefined,
      newValue: reviewed.newValue ?? undefined,
      metadata: {
        adminComment,
        entityType: reviewed.entityType,
        originalEntityId: reviewed.entityId,
        action: reviewed.action,
        fieldName: reviewed.fieldName,
        reason: reviewed.reason
      }
    });

    return reviewed;
  });

  return { ok: true as const, changeRequest: updated };
}

export const changeRequestInclude = {
  company: { select: { id: true, name: true, edrpou: true } },
  requestedBy: { select: { id: true, name: true, email: true, role: true } },
  reviewedBy: { select: { id: true, name: true, email: true, role: true } }
} satisfies Prisma.ChangeRequestInclude;
