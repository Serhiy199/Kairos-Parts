import type { Prisma, RequestStatus } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import {
  assertManagerSelectionMutationAllowed,
  ManagerSelectionMutationError
} from '@/lib/request-items/mutation-policy';
import type { RequestItemInput } from '@/lib/request-items/validation';
import {
  REQUEST_STATUS_EVENTS,
  transitionRequestStatus,
  type RequestStatusTransitionResult
} from '@/lib/requests/status-transition';
import { normalizeRequestStatusForSelection } from '@/lib/requests/statuses';

const REQUEST_ITEM_AUDIT_FIELDS = [
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

export type CreateRequestItemDraftInput = {
  requestId: string;
  data: RequestItemInput;
  actor: {
    id: string;
  };
  requestContext?: AuditRequestContext;
};

export type RequestItemDraftCreateErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ACTOR_NOT_ALLOWED'
  | 'FINAL_CLIENT_SELECTION_LOCKED'
  | 'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION'
  | 'REQUEST_ITEM_CREATE_FAILED';

export class RequestItemDraftCreateError extends Error {
  constructor(
    readonly code: RequestItemDraftCreateErrorCode,
    message: string,
    readonly context: {
      requestId: string;
      currentStatus?: RequestStatus;
    }
  ) {
    super(message);
    this.name = 'RequestItemDraftCreateError';
  }
}

export function requestStatusAllowsDraftItemCreation(status: RequestStatus) {
  const normalized = normalizeRequestStatusForSelection(status);
  return normalized === 'NEW'
    || normalized === 'IN_PROGRESS'
    || normalized === 'WAITING_APPROVAL';
}

function requestItemSnapshot(item: {
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  availability: string | null;
  salePrice: { toString(): string } | null;
  visibleToClient: boolean;
  includeInInvoice: boolean;
}) {
  return {
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
}

function requestItemLabel(name: string, catalogNumber: string | null) {
  return catalogNumber ? `${name} · ${catalogNumber}` : name;
}

function requestItemAuditCategory(snapshot: { salePrice: string | null; quantity: number }) {
  return snapshot.salePrice !== null || snapshot.quantity !== 1
    ? 'FINANCIAL_CRITICAL' as const
    : 'STANDARD' as const;
}

function terminalTransitionWasBlocked(
  transition: RequestStatusTransitionResult
): transition is Extract<RequestStatusTransitionResult, { outcome: 'blocked' }> {
  return transition.outcome === 'blocked' && transition.reason === 'terminal_status';
}

type TransactionRunner = {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T>;
};

export function createRequestItemDraftService(database: TransactionRunner) {
  return async function createRequestItemDraft(input: CreateRequestItemDraftInput) {
    return database.$transaction(async (tx) => {
      const request = await tx.request.findUnique({
        where: { id: input.requestId },
        select: {
          id: true,
          requestNumber: true,
          status: true,
          vehicleId: true,
          companyId: true
        }
      });

      if (!request) {
        throw new RequestItemDraftCreateError(
          'REQUEST_NOT_FOUND',
          `Request ${input.requestId} was not found while creating a draft item.`,
          { requestId: input.requestId }
        );
      }

      if (!requestStatusAllowsDraftItemCreation(request.status)) {
        throw new RequestItemDraftCreateError(
          'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION',
          `Request ${request.id} does not allow draft item creation in ${request.status}.`,
          { requestId: request.id, currentStatus: request.status }
        );
      }

      try {
        await assertManagerSelectionMutationAllowed(tx, {
          requestId: request.id,
          requestStatus: request.status,
          actorId: input.actor.id
        });
      } catch (error) {
        if (error instanceof ManagerSelectionMutationError) {
          throw new RequestItemDraftCreateError(
            error.code === 'ACTOR_NOT_ALLOWED'
              ? 'ACTOR_NOT_ALLOWED'
              : error.code === 'FINAL_CLIENT_SELECTION_LOCKED'
                ? 'FINAL_CLIENT_SELECTION_LOCKED'
              : 'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION',
            error.message,
            { requestId: request.id, currentStatus: request.status }
          );
        }
        throw error;
      }

      const { visibleToClient: _ignoredVisibility, ...itemData } = input.data;
      void _ignoredVisibility;

      const item = await tx.requestItem.create({
        data: {
          requestId: request.id,
          vehicleId: request.vehicleId,
          ...itemData,
          visibleToClient: false
        }
      }).catch(() => {
        throw new RequestItemDraftCreateError(
          'REQUEST_ITEM_CREATE_FAILED',
          `Draft item creation failed for request ${request.id}.`,
          { requestId: request.id, currentStatus: request.status }
        );
      });

      const snapshot = requestItemSnapshot(item);
      await writeAuditLog(tx, {
        actor: auditUserActor(input.actor.id),
        companyId: request.companyId,
        entityType: 'REQUEST_ITEM',
        entityId: item.id,
        entityLabel: requestItemLabel(item.name, item.catalogNumber),
        action: 'REQUEST_ITEM_CREATED',
        category: requestItemAuditCategory(snapshot),
        newValue: snapshot,
        metadata: {
          source: 'ADMIN_CRM',
          requestNumber: request.requestNumber
        },
        allowedFields: {
          newValue: REQUEST_ITEM_AUDIT_FIELDS,
          metadata: ['source', 'requestNumber']
        },
        requestContext: input.requestContext
      });

      const normalizedStatus = normalizeRequestStatusForSelection(request.status);
      const transition: RequestStatusTransitionResult =
        normalizedStatus === 'WAITING_APPROVAL' || request.status === 'OFFER_PREPARING'
          ? {
              outcome: 'noop',
              currentStatus: request.status,
              reason: 'idempotent_event'
            }
          : await transitionRequestStatus({
              requestId: request.id,
              event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
              actor: input.actor,
              reason: 'Підібрану позицію створено як чернетку',
              metadata: {
                source: 'ADMIN_CRM',
                eventKey: `request-item:${item.id}`,
                triggerEntityType: 'REQUEST_ITEM',
                triggerEntityId: item.id
              },
              tx
            });

      if (terminalTransitionWasBlocked(transition)) {
        throw new RequestItemDraftCreateError(
          'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION',
          `Request ${request.id} became terminal while creating a draft item.`,
          {
            requestId: request.id,
            currentStatus: transition.currentStatus
          }
        );
      }

      return {
        item,
        transition,
        request: {
          id: request.id,
          vehicleId: request.vehicleId
        }
      };
    }, { isolationLevel: 'Serializable' });
  };
}

export const createRequestItemDraft = createRequestItemDraftService(prisma);
