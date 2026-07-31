import type { Prisma } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import {
  assertManagerSelectionMutationAllowed,
  ManagerSelectionMutationError
} from '@/lib/request-items/mutation-policy';

const REQUEST_ITEM_DELETE_AUDIT_FIELDS = [
  'name',
  'brand',
  'catalogNumber',
  'analogNumber',
  'quantity',
  'availability',
  'salePrice',
  'visibleToClient',
  'includeInInvoice'
] as const;

export class RequestItemDeleteError extends Error {
  constructor(
    readonly code:
      | 'REQUEST_ITEM_NOT_FOUND'
      | 'ACTOR_NOT_ALLOWED'
      | 'REQUEST_SELECTION_MUTATION_LOCKED'
      | 'APPROVED_REQUEST_ITEM_DELETE_BLOCKED'
      | 'REQUEST_ITEM_DELETE_FAILED',
    readonly context: { requestItemId: string; requestId: string },
    options?: ErrorOptions
  ) {
    super(`Request item delete failed: ${code}.`, options);
    this.name = 'RequestItemDeleteError';
  }
}

export async function assertRequestItemDeleteAllowed(
  tx: Prisma.TransactionClient,
  input: { requestItemId: string; requestId: string }
) {
  const [item, approvedSnapshot, invoiceItem] = await Promise.all([
    tx.requestItem.findFirst({
      where: { id: input.requestItemId, requestId: input.requestId },
      select: { id: true }
    }),
    tx.requestSelectionBatchItem.findFirst({
      where: {
        sourceRequestItemId: input.requestItemId,
        status: 'APPROVED',
        batch: {
          requestId: input.requestId,
          status: { in: ['APPROVED', 'PARTIALLY_APPROVED'] }
        }
      },
      select: { id: true }
    }),
    tx.invoiceItem.findFirst({
      where: {
        requestItemId: input.requestItemId,
        invoice: { requestId: input.requestId }
      },
      select: { id: true }
    })
  ]);

  if (!item) {
    throw new RequestItemDeleteError('REQUEST_ITEM_NOT_FOUND', input);
  }
  if (approvedSnapshot || invoiceItem) {
    throw new RequestItemDeleteError(
      'APPROVED_REQUEST_ITEM_DELETE_BLOCKED',
      input
    );
  }
}

export type DeleteRequestItemInput = {
  requestItemId: string;
  requestId?: string;
  actor: { id: string };
  requestContext?: AuditRequestContext;
};

type TransactionRunner = {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T>;
};

type DeleteDependencies = {
  writeAudit: typeof writeAuditLog;
};

export function createDeleteRequestItemService(
  database: TransactionRunner,
  dependencies: DeleteDependencies = { writeAudit: writeAuditLog }
) {
  return async function deleteRequestItem(input: DeleteRequestItemInput) {
    try {
      return await database.$transaction(async (tx) => {
        const item = await tx.requestItem.findFirst({
          where: {
            id: input.requestItemId,
            ...(input.requestId ? { requestId: input.requestId } : {})
          },
          select: {
            id: true,
            requestId: true,
            vehicleId: true,
            name: true,
            brand: true,
            catalogNumber: true,
            analogNumber: true,
            quantity: true,
            availability: true,
            salePrice: true,
            visibleToClient: true,
            includeInInvoice: true,
            request: {
              select: {
                status: true,
                requestNumber: true,
                companyId: true
              }
            }
          }
        });
        if (!item) {
          throw new RequestItemDeleteError('REQUEST_ITEM_NOT_FOUND', {
            requestItemId: input.requestItemId,
            requestId: input.requestId ?? ''
          });
        }

        try {
          await assertManagerSelectionMutationAllowed(tx, {
            requestId: item.requestId,
            requestStatus: item.request.status,
            actorId: input.actor.id
          });
        } catch (error) {
          if (error instanceof ManagerSelectionMutationError) {
            throw new RequestItemDeleteError(
              error.code === 'ACTOR_NOT_ALLOWED'
                ? 'ACTOR_NOT_ALLOWED'
                : 'REQUEST_SELECTION_MUTATION_LOCKED',
              {
                requestItemId: item.id,
                requestId: item.requestId
              },
              { cause: error }
            );
          }
          throw error;
        }

        await assertRequestItemDeleteAllowed(tx, {
          requestItemId: item.id,
          requestId: item.requestId
        });

        const deleted = await tx.requestItem.deleteMany({
          where: { id: item.id, requestId: item.requestId }
        });
        if (deleted.count !== 1) {
          throw new RequestItemDeleteError('REQUEST_ITEM_NOT_FOUND', {
            requestItemId: item.id,
            requestId: item.requestId
          });
        }

        const snapshot = {
          name: item.name,
          brand: item.brand,
          catalogNumber: item.catalogNumber,
          analogNumber: item.analogNumber,
          quantity: item.quantity,
          availability: item.availability,
          salePrice: item.salePrice?.toString() ?? null,
          visibleToClient: item.visibleToClient,
          includeInInvoice: item.includeInInvoice
        };
        await dependencies.writeAudit(tx, {
          actor: auditUserActor(input.actor.id),
          companyId: item.request.companyId,
          entityType: 'REQUEST_ITEM',
          entityId: item.id,
          entityLabel: item.catalogNumber
            ? `${item.name} · ${item.catalogNumber}`
            : item.name,
          action: 'REQUEST_ITEM_DELETED',
          category:
            snapshot.salePrice !== null || snapshot.quantity !== 1
              ? 'FINANCIAL_CRITICAL'
              : 'STANDARD',
          oldValue: snapshot,
          metadata: {
            source: 'ADMIN_CRM',
            requestNumber: item.request.requestNumber
          },
          allowedFields: {
            oldValue: REQUEST_ITEM_DELETE_AUDIT_FIELDS,
            metadata: ['source', 'requestNumber']
          },
          requestContext: input.requestContext
        });

        return {
          item: {
            id: item.id,
            requestId: item.requestId,
            vehicleId: item.vehicleId
          }
        };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof RequestItemDeleteError) throw error;
      throw new RequestItemDeleteError(
        'REQUEST_ITEM_DELETE_FAILED',
        {
          requestItemId: input.requestItemId,
          requestId: input.requestId ?? ''
        },
        { cause: error }
      );
    }
  };
}

export const deleteRequestItem = createDeleteRequestItemService(prisma);
