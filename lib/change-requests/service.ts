import { ChangeRequestStatus } from '@prisma/client';
import type { ChangeAction, ChangeEntityType, Prisma } from '@prisma/client';

import { auditUserActor, createChangeRequestAuditLog, writeAuditLog } from '@/lib/audit-log/service';
import type { ClientAccessContext } from '@/lib/client/access';
import { requestAccessWhere, vehicleAccessWhere } from '@/lib/client/access';
import { applyChangeRequest } from '@/lib/change-requests/apply';
import { prisma } from '@/lib/prisma';
import {
  isEditableVehicleField,
  normalizeEditableVehicleValue,
  pickEditableVehicleFields
} from '@/lib/vehicles/change-snapshot';

type ChangeRequestInput = {
  entityType: ChangeEntityType;
  entityId: string;
  action: ChangeAction;
  fieldName: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason: string | null;
};

const CHANGE_REQUEST_AUDIT_VALUE_FIELDS = [
  'name', 'description', 'equipmentType', 'model', 'vinOrSerial', 'brand',
  'catalogNumber', 'analogNumber', 'quantity', 'unit', 'comment', 'type',
  'manufacturer', 'year', 'archivedAt', 'archivedById'
] as const;
const CHANGE_REQUEST_AUDIT_METADATA_FIELDS = [
  'adminComment', 'entityType', 'originalEntityId', 'action', 'fieldName',
  'normalizedField', 'reason', 'source'
] as const;

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
    let oldValue = input.oldValue;
    let newValue = input.newValue;

    if (input.entityType === 'VEHICLE' && input.action === 'UPDATE') {
      if (!isEditableVehicleField(input.fieldName)) {
        return { ok: false as const, status: 'change-request-field-not-allowed' };
      }

      const vehicle = await tx.vehicle.findFirst({
        where: access.companyId
          ? { id: input.entityId, companyId: access.companyId, clientId: null }
          : { id: input.entityId, companyId: null, client: { userId: access.userId } },
        select: { name: true, type: true, manufacturer: true, model: true, year: true, vinOrSerial: true, comment: true }
      });

      if (!vehicle) return { ok: false as const, status: 'entity-not-found-or-forbidden' };
      const proposedSource = input.newValue && typeof input.newValue === 'object' && !Array.isArray(input.newValue) && !('toJSON' in input.newValue)
        ? (input.newValue as Record<string, unknown>)[input.fieldName]
        : input.newValue;
      const proposed = normalizeEditableVehicleValue(input.fieldName, proposedSource);
      if (proposed === undefined) return { ok: false as const, status: 'change-request-invalid-value' };

      const current = pickEditableVehicleFields(vehicle)[input.fieldName];
      if (current === proposed) return { ok: false as const, status: 'change-request-no-changes' };

      const pending = await tx.changeRequest.findFirst({
        where: {
          entityType: 'VEHICLE',
          entityId: input.entityId,
          action: 'UPDATE',
          fieldName: input.fieldName,
          status: 'PENDING',
          OR: access.companyId ? [{ companyId: access.companyId }] : [{ requestedById: access.userId, companyId: null }]
        },
        select: { id: true }
      });
      if (pending) return { ok: false as const, status: 'change-request-already-pending' };

      oldValue = { [input.fieldName]: current };
      newValue = { [input.fieldName]: proposed };
    }

    const created = await tx.changeRequest.create({
      data: {
        companyId: access.companyId,
        requestedById: access.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        status: 'PENDING',
        fieldName: input.fieldName,
        oldValue,
        newValue,
        reason: input.reason
      },
      include: changeRequestInclude
    });

    await createChangeRequestAuditLog(tx, {
      actor: auditUserActor(access.userId),
      companyId: access.companyId,
      changeRequestId: created.id,
      entityId: created.id,
      action: 'CHANGE_REQUEST_CREATED',
      category: 'STANDARD',
      oldValue,
      newValue,
      metadata: {
        entityType: input.entityType,
        originalEntityId: input.entityId,
        action: input.action,
        fieldName: input.fieldName,
        reason: input.reason
      },
      allowedFields: {
        oldValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        newValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        metadata: CHANGE_REQUEST_AUDIT_METADATA_FIELDS
      }
    });

    return { ok: true as const, created };
  });

  if (!changeRequest.ok) return changeRequest;
  return { ok: true as const, changeRequest: changeRequest.created };
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
      actor: auditUserActor(access.userId),
      companyId: cancelled.companyId,
      changeRequestId: cancelled.id,
      entityId: cancelled.id,
      action: 'CHANGE_REQUEST_CANCELLED',
      category: 'STANDARD',
      oldValue: cancelled.oldValue ?? undefined,
      newValue: cancelled.newValue ?? undefined,
      metadata: {
        entityType: cancelled.entityType,
        originalEntityId: cancelled.entityId,
        action: cancelled.action,
        fieldName: cancelled.fieldName,
        reason: cancelled.reason
      },
      allowedFields: {
        oldValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        newValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        metadata: CHANGE_REQUEST_AUDIT_METADATA_FIELDS
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
      actor: auditUserActor(reviewedById),
      companyId: changeRequest.companyId,
      changeRequestId: changeRequest.id,
      entityId: changeRequest.id,
      action: 'CHANGE_REQUEST_APPROVED',
      category: 'STANDARD',
      oldValue: changeRequest.oldValue ?? undefined,
      newValue: changeRequest.newValue ?? undefined,
      metadata: {
        adminComment,
        entityType: changeRequest.entityType,
        originalEntityId: changeRequest.entityId,
        action: changeRequest.action,
        fieldName: changeRequest.fieldName,
        reason: changeRequest.reason
      },
      allowedFields: {
        oldValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        newValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        metadata: CHANGE_REQUEST_AUDIT_METADATA_FIELDS
      }
    });

    await writeAuditLog(tx, {
      actor: auditUserActor(reviewedById),
      companyId: changeRequest.companyId,
      changeRequestId: changeRequest.id,
      entityType: applyResult.audit.entityType,
      entityId: applyResult.audit.entityId,
      action: applyResult.audit.action,
      category: 'STANDARD',
      oldValue: applyResult.audit.oldValue,
      newValue: applyResult.audit.newValue,
      metadata: applyResult.audit.metadata,
      allowedFields: {
        oldValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        newValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        metadata: CHANGE_REQUEST_AUDIT_METADATA_FIELDS
      }
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
      actor: auditUserActor(reviewedById),
      companyId: reviewed.companyId,
      changeRequestId: reviewed.id,
      entityId: reviewed.id,
      action: status === 'REJECTED' ? 'CHANGE_REQUEST_REJECTED' : 'CHANGE_REQUEST_APPROVED',
      category: 'STANDARD',
      oldValue: reviewed.oldValue ?? undefined,
      newValue: reviewed.newValue ?? undefined,
      metadata: {
        adminComment,
        entityType: reviewed.entityType,
        originalEntityId: reviewed.entityId,
        action: reviewed.action,
        fieldName: reviewed.fieldName,
        reason: reviewed.reason
      },
      allowedFields: {
        oldValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        newValue: CHANGE_REQUEST_AUDIT_VALUE_FIELDS,
        metadata: CHANGE_REQUEST_AUDIT_METADATA_FIELDS
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
