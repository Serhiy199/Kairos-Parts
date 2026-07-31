import type { Prisma, RequestStatus } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import {
  getRequestSelectionResendEligibility,
  RequestSelectionResendEligibilityError,
  type RequestSelectionResendEligibility
} from '@/lib/request-selection/resend-eligibility';
import {
  createRequestSelectionBatchDraft,
  RequestSelectionBatchError,
  transitionRequestSelectionBatchStatus,
  type CreateRequestSelectionBatchInput,
  type CreateRequestSelectionBatchResult,
  type RequestSelectionBatchTransitionResult,
  type TransitionRequestSelectionBatchInput
} from '@/lib/request-selection/service';
import {
  REQUEST_STATUS_EVENTS,
  transitionRequestStatus,
  type RequestStatusTransitionResult,
  type TransitionRequestStatusInput
} from '@/lib/requests/status-transition';
import { sendTelegramRequestItemsApprovalNotification } from '@/lib/telegram/notifications';

const allowedRequestStatuses = new Set<RequestStatus>([
  'IN_PROGRESS',
  'OFFER_PREPARING',
  'WAITING_APPROVAL'
]);
const allowedActorRoles = new Set(['ADMIN', 'MANAGER']);

export type RequestSelectionSourceVersion = {
  id: string;
  updatedAt: Date;
};

export type SendRequestSelectionForApprovalInput = {
  requestId: string;
  requestItemIds: string[];
  expectedRequestItemVersions: RequestSelectionSourceVersion[];
  expectedActiveBatchId?: string;
  expectedActiveRevision?: number;
  actor: { id: string };
  mode?: 'INITIAL' | 'RESEND_ACTIVE';
  requestContext?: AuditRequestContext;
};

export type SendRequestSelectionForApprovalErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ACTOR_NOT_FOUND'
  | 'ACTOR_NOT_ALLOWED'
  | 'EMPTY_SELECTION'
  | 'DUPLICATE_REQUEST_ITEM_IDS'
  | 'REQUEST_ITEM_NOT_FOUND'
  | 'REQUEST_ITEM_NOT_IN_REQUEST'
  | 'SOURCE_ITEM_VERSION_CONFLICT'
  | 'SOURCE_ITEM_INVALID'
  | 'REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND'
  | 'ACTIVE_SENT_BATCH_CONFLICT'
  | 'ACTIVE_SELECTION_VERSION_CONFLICT'
  | 'NO_SELECTION_CHANGES'
  | 'DUPLICATE_SEND_OPERATION'
  | 'BATCH_CREATE_FAILED'
  | 'BATCH_SUPERSEDE_FAILED'
  | 'BATCH_SEND_FAILED'
  | 'VISIBILITY_UPDATE_FAILED'
  | 'AUDIT_WRITE_FAILED'
  | 'REQUEST_STATUS_TRANSITION_FAILED'
  | 'FINALIZED_SELECTION_LOCKED'
  | 'TRANSACTION_CLIENT_EXPIRED'
  | 'DATABASE_TRANSACTION_FAILED'
  | 'TELEGRAM_NOTIFICATION_FAILED';

export class SendRequestSelectionForApprovalError extends Error {
  constructor(
    readonly code: SendRequestSelectionForApprovalErrorCode,
    readonly context: {
      requestId: string;
      requestItemId?: string;
      batchId?: string;
    },
    options?: ErrorOptions
  ) {
    super(`Send request selection for approval failed: ${code}.`, options);
    this.name = 'SendRequestSelectionForApprovalError';
  }
}

type NotificationResult =
  | { status: 'sent'; notificationId: string; retryable: false }
  | {
      status: 'failed';
      notificationId?: string;
      retryable: true;
      errorCode: 'TELEGRAM_NOTIFICATION_FAILED';
    }
  | {
      status: 'skipped-no-recipient' | 'skipped-request-not-found';
      retryable: false;
    };

export type SendRequestSelectionForApprovalResult = {
  requestId: string;
  batchId: string;
  revision: number;
  itemCount: number;
  supersededBatchId: string | null;
  hiddenPreviousItemCount: number;
  requestStatusTransition: RequestStatusTransitionResult['outcome'];
  notification: NotificationResult;
  mode: 'INITIAL' | 'RESEND_ACTIVE';
};

export type SendRequestSelectionCommitResult = Omit<
  SendRequestSelectionForApprovalResult,
  'notification'
>;

export const REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 15_000,
  isolationLevel: 'Serializable' as const
} as const;

type TransactionRunner = {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T>;
};

type SendDependencies = {
  createBatch(input: CreateRequestSelectionBatchInput): Promise<CreateRequestSelectionBatchResult>;
  transitionBatch(
    input: TransitionRequestSelectionBatchInput
  ): Promise<RequestSelectionBatchTransitionResult>;
  transitionRequest(input: TransitionRequestStatusInput): Promise<RequestStatusTransitionResult>;
  notify(input: {
    requestId: string;
    updatedSelection?: boolean;
  }): ReturnType<typeof sendTelegramRequestItemsApprovalNotification>;
  getResendEligibility?(input: {
    requestId: string;
    tx: Prisma.TransactionClient;
  }): Promise<RequestSelectionResendEligibility>;
};

const defaultDependencies: SendDependencies = {
  createBatch: createRequestSelectionBatchDraft,
  transitionBatch: transitionRequestSelectionBatchStatus,
  transitionRequest: transitionRequestStatus,
  notify: sendTelegramRequestItemsApprovalNotification,
  getResendEligibility: getRequestSelectionResendEligibility
};

function fail(
  code: SendRequestSelectionForApprovalErrorCode,
  requestId: string,
  context: { requestItemId?: string; batchId?: string } = {},
  cause?: unknown
): never {
  throw new SendRequestSelectionForApprovalError(
    code,
    { requestId, ...context },
    cause === undefined ? undefined : { cause }
  );
}

export function isExpiredPrismaTransactionError(error: unknown) {
  let current = error;
  const visited = new Set<unknown>();

  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    if (
      candidate.code === 'P2028'
      || message.includes('Transaction not found')
      || message.includes('old closed transaction')
      || message.includes('transaction is no longer valid')
    ) {
      return true;
    }
    current = candidate.cause;
  }

  return false;
}

function assertInput(input: SendRequestSelectionForApprovalInput) {
  if (
    input.mode !== undefined
    && input.mode !== 'INITIAL'
    && input.mode !== 'RESEND_ACTIVE'
  ) {
    fail('FINALIZED_SELECTION_LOCKED', input.requestId);
  }
  if (input.requestItemIds.length === 0) {
    fail('EMPTY_SELECTION', input.requestId);
  }
  if (new Set(input.requestItemIds).size !== input.requestItemIds.length) {
    fail('DUPLICATE_REQUEST_ITEM_IDS', input.requestId);
  }

  const expectedById = new Map(
    input.expectedRequestItemVersions.map((entry) => [entry.id, entry.updatedAt])
  );
  if (
    expectedById.size !== input.requestItemIds.length
    || input.expectedRequestItemVersions.length !== input.requestItemIds.length
  ) {
    fail('SOURCE_ITEM_VERSION_CONFLICT', input.requestId);
  }
  for (const requestItemId of input.requestItemIds) {
    const expected = expectedById.get(requestItemId);
    if (!expected || Number.isNaN(expected.getTime())) {
      fail('SOURCE_ITEM_VERSION_CONFLICT', input.requestId, { requestItemId });
    }
  }
}

function mapBatchError(
  error: RequestSelectionBatchError,
  phase: 'create' | 'supersede' | 'send',
  requestId: string
): never {
  const context = {
    requestItemId: error.context.requestItemId,
    batchId: error.context.batchId
  };
  if (error.code === 'REQUEST_NOT_FOUND') fail('REQUEST_NOT_FOUND', requestId, context, error);
  if (error.code === 'ACTOR_NOT_FOUND') fail('ACTOR_NOT_FOUND', requestId, context, error);
  if (error.code === 'ACTOR_NOT_ALLOWED') fail('ACTOR_NOT_ALLOWED', requestId, context, error);
  if (error.code === 'EMPTY_SELECTION') fail('EMPTY_SELECTION', requestId, context, error);
  if (error.code === 'DUPLICATE_REQUEST_ITEM_IDS') {
    fail('DUPLICATE_REQUEST_ITEM_IDS', requestId, context, error);
  }
  if (error.code === 'REQUEST_ITEM_NOT_FOUND') {
    fail('REQUEST_ITEM_NOT_FOUND', requestId, context, error);
  }
  if (error.code === 'REQUEST_ITEM_NOT_IN_REQUEST') {
    fail('REQUEST_ITEM_NOT_IN_REQUEST', requestId, context, error);
  }
  if (error.code === 'SOURCE_ITEM_CHANGED') {
    fail('SOURCE_ITEM_VERSION_CONFLICT', requestId, context, error);
  }
  if (error.code === 'SOURCE_ITEM_INVALID' || error.code === 'SNAPSHOT_BUILD_FAILED') {
    fail('SOURCE_ITEM_INVALID', requestId, context, error);
  }
  if (error.code === 'ACTIVE_SENT_BATCH_CONFLICT') {
    fail('ACTIVE_SENT_BATCH_CONFLICT', requestId, context, error);
  }
  if (phase === 'supersede') fail('BATCH_SUPERSEDE_FAILED', requestId, context, error);
  if (phase === 'send') fail('BATCH_SEND_FAILED', requestId, context, error);
  fail('BATCH_CREATE_FAILED', requestId, context, error);
}

export function createSendRequestSelectionForApprovalService(
  database: TransactionRunner,
  dependencies: SendDependencies = defaultDependencies
) {
  const resolveResendEligibility =
    dependencies.getResendEligibility ?? defaultDependencies.getResendEligibility!;

  return async function sendRequestSelectionForApproval(
    input: SendRequestSelectionForApprovalInput
  ): Promise<SendRequestSelectionForApprovalResult> {
    assertInput(input);

    const executeTransaction = async (
      tx: Prisma.TransactionClient
    ): Promise<SendRequestSelectionCommitResult> => {
      const [request, actor] = await Promise.all([
        tx.request.findUnique({
          where: { id: input.requestId },
          select: { id: true, requestNumber: true, companyId: true, status: true }
        }),
        tx.user.findUnique({
          where: { id: input.actor.id },
          select: { id: true, role: true, status: true }
        })
      ]);
      if (!request) fail('REQUEST_NOT_FOUND', input.requestId);
      if (!actor) fail('ACTOR_NOT_FOUND', request.id);
      if (actor.status !== 'ACTIVE' || !allowedActorRoles.has(actor.role)) {
        fail('ACTOR_NOT_ALLOWED', request.id);
      }
      const requestedMode = input.mode;
      if (!allowedRequestStatuses.has(request.status)) {
        fail('REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND', request.id);
      }

      let resendEligibility: RequestSelectionResendEligibility;
      try {
        resendEligibility = await resolveResendEligibility({
          requestId: request.id,
          tx
        });
      } catch (error) {
        if (
          error instanceof RequestSelectionResendEligibilityError
          && error.code === 'REQUEST_NOT_FOUND'
        ) {
          fail('REQUEST_NOT_FOUND', request.id, {}, error);
        }
        fail('SOURCE_ITEM_INVALID', request.id, {}, error);
      }
      if (!resendEligibility.canSend) {
        if (resendEligibility.finalizedSelectionLocked) {
          fail('FINALIZED_SELECTION_LOCKED', request.id);
        }
        if (resendEligibility.reason === 'REQUEST_STATUS_BLOCKED') {
          fail('REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND', request.id);
        }
        if (resendEligibility.reason === 'NOTHING_TO_SEND') {
          fail('NO_SELECTION_CHANGES', request.id, {
            batchId: resendEligibility.activeBatchId ?? undefined
          });
        }
        fail('DUPLICATE_SEND_OPERATION', request.id, {
          batchId: resendEligibility.activeBatchId ?? undefined
        });
      }
      const canonicalItemIds = resendEligibility.eligibleItemIds;
      const resolvedMode = resendEligibility.mode
        ?? (resendEligibility.activeBatchId ? 'RESEND_ACTIVE' : 'INITIAL');
      if (resolvedMode === 'FOLLOW_UP_REJECTED') {
        fail('FINALIZED_SELECTION_LOCKED', request.id);
      }
      const mode: 'INITIAL' | 'RESEND_ACTIVE' = resolvedMode;
      if (requestedMode && requestedMode !== mode) {
        fail('SOURCE_ITEM_INVALID', request.id);
      }

      const activeBatches = await tx.requestSelectionBatch.findMany({
        where: { requestId: request.id, status: 'SENT' },
        orderBy: [{ revision: 'desc' }, { id: 'asc' }],
        take: 2,
        select: {
          id: true,
          revision: true,
          items: {
            orderBy: { position: 'asc' },
            select: { sourceRequestItemId: true, sourceUpdatedAt: true }
          }
        }
      });
      if (activeBatches.length > 1) {
        fail('ACTIVE_SENT_BATCH_CONFLICT', request.id);
      }
      const activeBatch = activeBatches[0] ?? null;
      if (
        mode === 'RESEND_ACTIVE'
        && (
          !activeBatch
          || !input.expectedActiveBatchId
          || !Number.isSafeInteger(input.expectedActiveRevision)
          || activeBatch.id !== input.expectedActiveBatchId
          || activeBatch.revision !== input.expectedActiveRevision
        )
      ) {
        fail('ACTIVE_SELECTION_VERSION_CONFLICT', request.id, {
          batchId: activeBatch?.id
        });
      }
      const sourceItems = await tx.requestItem.findMany({
        where: { id: { in: input.requestItemIds } },
        select: { id: true, requestId: true, updatedAt: true, visibleToClient: true }
      });
      const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
      const expectedById = new Map(
        input.expectedRequestItemVersions.map((entry) => [entry.id, entry.updatedAt])
      );
      for (const requestItemId of input.requestItemIds) {
        const sourceItem = sourceById.get(requestItemId);
        if (!sourceItem) fail('REQUEST_ITEM_NOT_FOUND', request.id, { requestItemId });
        if (sourceItem.requestId !== request.id) {
          fail('REQUEST_ITEM_NOT_IN_REQUEST', request.id, { requestItemId });
        }
        if (
          sourceItem.updatedAt.getTime() !== expectedById.get(requestItemId)?.getTime()
        ) {
          fail('SOURCE_ITEM_VERSION_CONFLICT', request.id, { requestItemId });
        }
      }
      const submittedIds = new Set(input.requestItemIds);
      if (
        canonicalItemIds.length !== input.requestItemIds.length
        || canonicalItemIds.some((id) => !submittedIds.has(id))
      ) {
        fail('SOURCE_ITEM_INVALID', request.id);
      }

      if (activeBatch) {
        try {
          const superseded = await dependencies.transitionBatch({
            batchId: activeBatch.id,
            event: 'SUPERSEDE',
            actor: input.actor,
            source: 'ADMIN_CRM',
            requestContext: input.requestContext,
            tx
          });
          if (superseded.outcome !== 'changed') {
            fail('BATCH_SUPERSEDE_FAILED', request.id, { batchId: activeBatch.id });
          }
        } catch (error) {
          if (error instanceof SendRequestSelectionForApprovalError) throw error;
          if (error instanceof RequestSelectionBatchError) {
            mapBatchError(error, 'supersede', request.id);
          }
          fail('BATCH_SUPERSEDE_FAILED', request.id, { batchId: activeBatch.id }, error);
        }
      }

      let batch: CreateRequestSelectionBatchResult;
      try {
        batch = await dependencies.createBatch({
          requestId: request.id,
          requestItemIds: canonicalItemIds,
          expectedRequestItemVersions: input.expectedRequestItemVersions,
          actor: input.actor,
          source: 'ADMIN_CRM',
          requestContext: input.requestContext,
          tx
        });
      } catch (error) {
        if (error instanceof RequestSelectionBatchError) {
          mapBatchError(error, 'create', request.id);
        }
        fail('BATCH_CREATE_FAILED', request.id, {}, error);
      }

      try {
        const sent = await dependencies.transitionBatch({
          batchId: batch.batchId,
          event: 'SEND',
          actor: input.actor,
          source: 'ADMIN_CRM',
          requestContext: input.requestContext,
          tx
        });
        if (sent.outcome !== 'changed') {
          fail('BATCH_SEND_FAILED', request.id, { batchId: batch.batchId });
        }
      } catch (error) {
        if (error instanceof SendRequestSelectionForApprovalError) throw error;
        if (error instanceof RequestSelectionBatchError) {
          mapBatchError(error, 'send', request.id);
        }
        fail('BATCH_SEND_FAILED', request.id, { batchId: batch.batchId }, error);
      }

      let requestStatusTransition: RequestStatusTransitionResult;
      try {
        requestStatusTransition = await dependencies.transitionRequest({
          requestId: request.id,
          event: REQUEST_STATUS_EVENTS.SELECTION_SENT_FOR_APPROVAL,
          actor: input.actor,
          metadata: {
            source: 'ADMIN_CRM',
            eventKey: `selection-batch:${batch.batchId}:sent`,
            triggerEntityType: 'REQUEST',
            triggerEntityId: request.id,
            followUp: false,
            followUpFromBatchId: undefined,
            followUpFromRevision: undefined,
            candidateCount: canonicalItemIds.length
          },
          tx
        });
      } catch (error) {
        fail('REQUEST_STATUS_TRANSITION_FAILED', request.id, { batchId: batch.batchId }, error);
      }
      if (requestStatusTransition.outcome === 'blocked') {
        fail('REQUEST_STATUS_TRANSITION_FAILED', request.id, { batchId: batch.batchId });
      }

      const previousSourceIds = activeBatch?.items
        .map((item) => item.sourceRequestItemId)
        .filter((id): id is string => Boolean(id)) ?? [];
      const selectedIds = new Set(canonicalItemIds);
      const sourcesToHide = previousSourceIds.filter((id) => !selectedIds.has(id));
      let hiddenPrevious: { count: number };
      let selected: { count: number };
      try {
        hiddenPrevious = sourcesToHide.length === 0
          ? { count: 0 }
          : await tx.requestItem.updateMany({
              where: { requestId: request.id, id: { in: sourcesToHide } },
              data: { visibleToClient: false }
            });

        selected = await tx.requestItem.updateMany({
          where: { requestId: request.id, id: { in: canonicalItemIds } },
          data: {
            visibleToClient: true,
            approvedByClient: false,
            approvedAt: null,
            includeInInvoice: false
          }
        });
      } catch (error) {
        fail('VISIBILITY_UPDATE_FAILED', request.id, { batchId: batch.batchId }, error);
      }
      if (selected.count !== canonicalItemIds.length) {
        fail('VISIBILITY_UPDATE_FAILED', request.id, { batchId: batch.batchId });
      }

      try {
        await writeAuditLog(tx, {
          actor: auditUserActor(input.actor.id),
          companyId: request.companyId,
          entityType: 'REQUEST',
          entityId: request.id,
          entityLabel: `Заявка ${request.requestNumber}`,
          action: 'REQUEST_ITEMS_SENT_FOR_APPROVAL',
          category: 'STANDARD',
          metadata: {
            source: 'ADMIN_CRM',
            itemCount: selected.count,
            itemIds: canonicalItemIds.slice(0, 50),
            batchId: batch.batchId,
            revision: batch.revision,
            supersededBatchId: activeBatch?.id ?? null,
            resendReason: resendEligibility.reason,
            changedItemCount: resendEligibility.changedItemIds.length,
            newItemCount: resendEligibility.newItemIds.length,
            removedItemCount: resendEligibility.removedBatchItemIds.length,
            previousRevision: resendEligibility.activeRevision,
            followUp: false,
            followUpFromBatchId: undefined,
            followUpFromRevision: undefined,
            candidateCount: canonicalItemIds.length,
            changedRejectedCount: resendEligibility.changedRejectedItemIds?.length ?? 0,
            newReplacementCount: resendEligibility.newItemIds.length,
            updateReason:
              mode === 'RESEND_ACTIVE'
                ? 'MANAGER_UPDATED_BEFORE_CLIENT_FINAL_DECISION'
                : 'INITIAL_SELECTION_SENT'
          },
          allowedFields: {
            metadata: [
              'source',
              'itemCount',
              'itemIds',
              'batchId',
              'revision',
              'supersededBatchId',
              'resendReason',
              'changedItemCount',
              'newItemCount',
              'removedItemCount',
              'previousRevision',
              'followUp',
              'followUpFromBatchId',
              'followUpFromRevision',
              'candidateCount',
              'changedRejectedCount',
              'newReplacementCount',
              'updateReason'
            ]
          },
          requestContext: input.requestContext
        });
      } catch (error) {
        fail('AUDIT_WRITE_FAILED', request.id, { batchId: batch.batchId }, error);
      }

      return {
        requestId: request.id,
        batchId: batch.batchId,
        revision: batch.revision,
        itemCount: batch.itemCount,
        supersededBatchId: activeBatch?.id ?? null,
        hiddenPreviousItemCount: hiddenPrevious.count,
        requestStatusTransition: requestStatusTransition.outcome,
        mode
      };
    };

    let committed: SendRequestSelectionCommitResult;
    try {
      committed = await database.$transaction(
        executeTransaction,
        REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS
      );
    } catch (error) {
      if (isExpiredPrismaTransactionError(error)) {
        fail('TRANSACTION_CLIENT_EXPIRED', input.requestId, {}, error);
      }
      if (error instanceof SendRequestSelectionForApprovalError) throw error;
      if (
        error
        && typeof error === 'object'
        && 'code' in error
        && error.code === 'P2034'
      ) {
        fail('ACTIVE_SENT_BATCH_CONFLICT', input.requestId, {}, error);
      }
      fail('DATABASE_TRANSACTION_FAILED', input.requestId, {}, error);
    }

    let notification: NotificationResult;
    try {
      const result = await dependencies.notify({
        requestId: committed.requestId,
        updatedSelection: committed.mode === 'RESEND_ACTIVE'
      });
      notification = result.status === 'sent'
        ? { ...result, retryable: false }
        : result.status === 'failed'
          ? {
              ...result,
              retryable: true,
              errorCode: 'TELEGRAM_NOTIFICATION_FAILED'
            }
          : { ...result, retryable: false };
    } catch {
      notification = {
        status: 'failed',
        retryable: true,
        errorCode: 'TELEGRAM_NOTIFICATION_FAILED'
      };
    }

    return { ...committed, notification };
  };
}

export const sendRequestSelectionForApproval =
  createSendRequestSelectionForApprovalService(prisma);
