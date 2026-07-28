import { Prisma, type UserRole } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import type { RequestItemUpdateValues } from '@/lib/request-items/validation';

const REQUEST_ITEM_UPDATE_FIELDS = [
  'equipmentType',
  'name',
  'brand',
  'catalogNumber',
  'quantity',
  'unit',
  'availability',
  'salePrice',
  'currency',
  'comment'
] as const;

export type RequestItemUpdateErrorCode =
  | 'REQUEST_ITEM_NOT_FOUND'
  | 'REQUEST_ITEM_NOT_IN_REQUEST'
  | 'ACTOR_NOT_ALLOWED'
  | 'REQUEST_ITEM_VALIDATION_FAILED'
  | 'REQUEST_ITEM_VERSION_CONFLICT'
  | 'APPROVED_REQUEST_ITEM_LOCKED'
  | 'REQUEST_ITEM_UPDATE_FAILED'
  | 'REQUEST_ITEM_UPDATE_NOT_PERSISTED';

export class RequestItemUpdateError extends Error {
  constructor(
    readonly code: RequestItemUpdateErrorCode,
    readonly context: {
      requestItemId: string;
      requestId: string;
      expectedUpdatedAt?: string;
    },
    options?: ErrorOptions
  ) {
    super(`Request item update failed: ${code}.`, options);
    this.name = 'RequestItemUpdateError';
  }
}

export type UpdateRequestItemInput = {
  requestItemId: string;
  requestId: string;
  expectedUpdatedAt: string;
  actor: { id: string };
  values: RequestItemUpdateValues;
  requestContext?: AuditRequestContext;
};

export type UpdateRequestItemResult = {
  outcome: 'changed' | 'no_changes';
  code: 'REQUEST_ITEM_UPDATED' | 'REQUEST_ITEM_NO_CHANGES';
  item: {
    id: string;
    requestId: string;
    vehicleId: string | null;
    quantity: number;
    updatedAt: string;
  };
  changedFields: string[];
};

const itemSelect = {
  id: true,
  requestId: true,
  vehicleId: true,
  equipmentType: true,
  name: true,
  brand: true,
  catalogNumber: true,
  analogNumber: true,
  quantity: true,
  unit: true,
  availability: true,
  salePrice: true,
  currency: true,
  comment: true,
  visibleToClient: true,
  includeInInvoice: true,
  updatedAt: true,
  request: {
    select: {
      requestNumber: true,
      companyId: true
    }
  }
} satisfies Prisma.RequestItemSelect;

type PersistedItem = Prisma.RequestItemGetPayload<{ select: typeof itemSelect }>;

function decimalString(value: Prisma.Decimal | string | null) {
  return value === null ? null : new Prisma.Decimal(value).toString();
}

function comparableSnapshot(item: PersistedItem | RequestItemUpdateValues) {
  return {
    equipmentType: item.equipmentType,
    name: item.name,
    brand: item.brand,
    catalogNumber: item.catalogNumber,
    quantity: item.quantity,
    unit: item.unit,
    availability: item.availability,
    salePrice: decimalString(item.salePrice),
    currency: item.currency,
    comment: item.comment
  };
}

function itemResult(item: PersistedItem): UpdateRequestItemResult['item'] {
  return {
    id: item.id,
    requestId: item.requestId,
    vehicleId: item.vehicleId,
    quantity: item.quantity,
    updatedAt: item.updatedAt.toISOString()
  };
}

function itemLabel(item: Pick<PersistedItem, 'name' | 'catalogNumber'>) {
  return item.catalogNumber ? `${item.name} · ${item.catalogNumber}` : item.name;
}

function actorAllowed(actor: { role: UserRole; status: string } | null) {
  return Boolean(
    actor
    && actor.status === 'ACTIVE'
    && (actor.role === 'ADMIN' || actor.role === 'MANAGER')
  );
}

type TransactionRunner = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

type UpdateDependencies = {
  writeAudit: typeof writeAuditLog;
};

export function createUpdateRequestItemService(
  database: TransactionRunner,
  dependencies: UpdateDependencies = { writeAudit: writeAuditLog }
) {
  return async function updateRequestItem(
    input: UpdateRequestItemInput
  ): Promise<UpdateRequestItemResult> {
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
    if (
      !input.requestItemId
      || !input.requestId
      || !input.actor.id
      || Number.isNaN(expectedUpdatedAt.getTime())
    ) {
      throw new RequestItemUpdateError('REQUEST_ITEM_VALIDATION_FAILED', {
        requestItemId: input.requestItemId,
        requestId: input.requestId,
        expectedUpdatedAt: input.expectedUpdatedAt
      });
    }

    try {
      return await database.$transaction(async (tx) => {
        const actor = await tx.user.findUnique({
          where: { id: input.actor.id },
          select: { role: true, status: true }
        });
        if (!actorAllowed(actor)) {
          throw new RequestItemUpdateError('ACTOR_NOT_ALLOWED', {
            requestItemId: input.requestItemId,
            requestId: input.requestId
          });
        }

        const existing = await tx.requestItem.findUnique({
          where: { id: input.requestItemId },
          select: itemSelect
        });
        if (!existing) {
          throw new RequestItemUpdateError('REQUEST_ITEM_NOT_FOUND', {
            requestItemId: input.requestItemId,
            requestId: input.requestId
          });
        }
        if (existing.requestId !== input.requestId) {
          throw new RequestItemUpdateError('REQUEST_ITEM_NOT_IN_REQUEST', {
            requestItemId: input.requestItemId,
            requestId: input.requestId
          });
        }
        if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          throw new RequestItemUpdateError('REQUEST_ITEM_VERSION_CONFLICT', {
            requestItemId: input.requestItemId,
            requestId: input.requestId,
            expectedUpdatedAt: input.expectedUpdatedAt
          });
        }

        const before = comparableSnapshot(existing);
        const desired = comparableSnapshot(input.values);
        const changedFields = REQUEST_ITEM_UPDATE_FIELDS.filter(
          (field) => before[field] !== desired[field]
        );

        if (changedFields.length === 0) {
          return {
            outcome: 'no_changes',
            code: 'REQUEST_ITEM_NO_CHANGES',
            item: itemResult(existing),
            changedFields: []
          };
        }

        const approvedSnapshot = await tx.requestSelectionBatchItem.findFirst({
          where: {
            sourceRequestItemId: existing.id,
            status: 'APPROVED',
            batch: {
              requestId: input.requestId,
              status: { in: ['APPROVED', 'PARTIALLY_APPROVED'] }
            }
          },
          select: { id: true }
        });
        if (approvedSnapshot) {
          throw new RequestItemUpdateError('APPROVED_REQUEST_ITEM_LOCKED', {
            requestItemId: input.requestItemId,
            requestId: input.requestId
          });
        }

        const diff = buildAuditDiff(before, desired, REQUEST_ITEM_UPDATE_FIELDS);
        const update = await tx.requestItem.updateMany({
          where: {
            id: existing.id,
            requestId: input.requestId,
            updatedAt: expectedUpdatedAt
          },
          data: input.values
        });
        if (update.count !== 1) {
          throw new RequestItemUpdateError('REQUEST_ITEM_VERSION_CONFLICT', {
            requestItemId: input.requestItemId,
            requestId: input.requestId,
            expectedUpdatedAt: input.expectedUpdatedAt
          });
        }

        const persisted = await tx.requestItem.findUnique({
          where: { id: existing.id },
          select: itemSelect
        });
        if (!persisted) {
          throw new RequestItemUpdateError('REQUEST_ITEM_UPDATE_NOT_PERSISTED', {
            requestItemId: input.requestItemId,
            requestId: input.requestId
          });
        }

        const persistedSnapshot = comparableSnapshot(persisted);
        const mismatchedField = REQUEST_ITEM_UPDATE_FIELDS.find(
          (field) => persistedSnapshot[field] !== desired[field]
        );
        if (mismatchedField) {
          throw new RequestItemUpdateError('REQUEST_ITEM_UPDATE_NOT_PERSISTED', {
            requestItemId: input.requestItemId,
            requestId: input.requestId
          });
        }

        await dependencies.writeAudit(tx, {
          actor: auditUserActor(input.actor.id),
          companyId: existing.request.companyId,
          entityType: 'REQUEST_ITEM',
          entityId: existing.id,
          entityLabel: itemLabel(persisted),
          action: 'REQUEST_ITEM_UPDATED',
          category: changedFields.includes('salePrice') || changedFields.includes('quantity')
            ? 'FINANCIAL_CRITICAL'
            : 'STANDARD',
          oldValue: diff.before,
          newValue: diff.after,
          metadata: {
            source: 'ADMIN_CRM',
            requestNumber: existing.request.requestNumber
          },
          allowedFields: {
            oldValue: REQUEST_ITEM_UPDATE_FIELDS,
            newValue: REQUEST_ITEM_UPDATE_FIELDS,
            metadata: ['source', 'requestNumber']
          },
          requestContext: input.requestContext
        });

        return {
          outcome: 'changed',
          code: 'REQUEST_ITEM_UPDATED',
          item: itemResult(persisted),
          changedFields
        };
      });
    } catch (error) {
      if (error instanceof RequestItemUpdateError) throw error;
      throw new RequestItemUpdateError(
        'REQUEST_ITEM_UPDATE_FAILED',
        {
          requestItemId: input.requestItemId,
          requestId: input.requestId,
          expectedUpdatedAt: input.expectedUpdatedAt
        },
        { cause: error }
      );
    }
  };
}

export const updateRequestItem = createUpdateRequestItemService(prisma);
