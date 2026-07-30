import type {
  Prisma,
  RequestStatus
} from '@prisma/client';

import type { AuditRequestContext, AuditSource } from '@/lib/audit-log/contracts';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import {
  RequestSelectionBatchError,
  transitionRequestSelectionBatchStatus
} from '@/lib/request-selection/service';
import {
  REQUEST_STATUS_EVENTS,
  RequestStatusTransitionError,
  transitionRequestStatus
} from '@/lib/requests/status-transition';

export type SubmitClientSelectionInput = {
  requestId: string;
  batchId: string;
  expectedRevision: number;
  approvedBatchItemIds: string[];
  actor: { id: string };
  source?: AuditSource;
  requestContext?: AuditRequestContext;
  tx?: Prisma.TransactionClient;
};

export type SubmitClientSelectionErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ACTOR_NOT_FOUND'
  | 'ACTOR_NOT_ALLOWED'
  | 'REQUEST_ACCESS_DENIED'
  | 'BATCH_NOT_FOUND'
  | 'BATCH_NOT_ACTIVE'
  | 'STALE_SELECTION_REVISION'
  | 'DUPLICATE_BATCH_ITEM_ID'
  | 'UNKNOWN_BATCH_ITEM_ID'
  | 'EMPTY_BATCH'
  | 'REQUEST_STATUS_DOES_NOT_ALLOW_SUBMISSION'
  | 'SUBMISSION_CONFLICT'
  | 'CONCURRENT_SUBMISSION'
  | 'BATCH_TRANSITION_FAILED'
  | 'REQUEST_STATUS_TRANSITION_FAILED'
  | 'FINALIZATION_INVARIANT_FAILED'
  | 'AUDIT_WRITE_FAILED'
  | 'DATABASE_TRANSACTION_FAILED';

export class SubmitClientSelectionError extends Error {
  constructor(
    readonly code: SubmitClientSelectionErrorCode,
    readonly context: {
      requestId: string;
      batchId?: string;
      expectedRevision?: number;
    },
    options?: ErrorOptions
  ) {
    super(`Aggregate client selection submission failed: ${code}.`, options);
    this.name = 'SubmitClientSelectionError';
  }
}

export type SubmitClientSelectionResult =
  | {
      outcome: 'changed';
      batchStatus: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
      requestStatus: 'AWAITING_INVOICE' | 'CANCELLED';
      totalCount: number;
      approvedCount: number;
      rejectedCount: number;
      auditLogId: string;
    }
  | {
      outcome: 'noop';
      reason: 'identical_submission';
      batchStatus: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
      requestStatus: RequestStatus;
      totalCount: number;
      approvedCount: number;
      rejectedCount: number;
    };

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

type SubmitClientSelectionDependencies = {
  transitionBatch: typeof transitionRequestSelectionBatchStatus;
  transitionRequest: typeof transitionRequestStatus;
  writeAudit: typeof writeAuditLog;
};

const defaultDependencies: SubmitClientSelectionDependencies = {
  transitionBatch: transitionRequestSelectionBatchStatus,
  transitionRequest: transitionRequestStatus,
  writeAudit: writeAuditLog
};

const transactionOptions = {
  maxWait: 5_000,
  timeout: 15_000,
  isolationLevel: 'Serializable' as const
};

function submissionError(
  code: SubmitClientSelectionErrorCode,
  input: Pick<
    SubmitClientSelectionInput,
    'requestId' | 'batchId' | 'expectedRevision'
  >,
  cause?: unknown
) {
  return new SubmitClientSelectionError(
    code,
    {
      requestId: input.requestId,
      batchId: input.batchId,
      expectedRevision: input.expectedRevision
    },
    cause === undefined ? undefined : { cause }
  );
}

function databaseErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
}

function actorCanAccessRequest(
  actor: {
    clientProfile: { id: string } | null;
    companyMemberships: Array<{ companyId: string }>;
  },
  request: { clientId: string | null; companyId: string | null }
) {
  if (!actor.clientProfile) return false;
  if (request.companyId) {
    return actor.companyMemberships.some(
      (membership) => membership.companyId === request.companyId
    );
  }
  return request.clientId === actor.clientProfile.id;
}

function normalizeApprovedIds(
  ids: readonly string[],
  input: SubmitClientSelectionInput
) {
  const normalized = ids.map((id) => id.trim());
  const unique = new Set(normalized);
  if (
    normalized.some((id) => id.length === 0)
    || unique.size !== normalized.length
  ) {
    throw submissionError('DUPLICATE_BATCH_ITEM_ID', input);
  }
  return [...unique].sort();
}

function expectedBatchStatus(approvedCount: number, totalCount: number) {
  if (approvedCount === totalCount) return 'APPROVED' as const;
  if (approvedCount > 0) return 'PARTIALLY_APPROVED' as const;
  return 'REJECTED' as const;
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length
    && left.every((id, index) => id === right[index]);
}

function requestReachedTarget(
  result:
    | Awaited<ReturnType<typeof transitionRequestStatus>>
    | { outcome: 'blocked' },
  persistedStatus: RequestStatus,
  target: 'AWAITING_INVOICE' | 'CANCELLED'
) {
  return (
    (
      result.outcome === 'changed'
      && result.nextStatus === target
    )
    || (
      result.outcome === 'noop'
      && result.currentStatus === target
    )
  ) && persistedStatus === target;
}

async function executeClientSelectionSubmission(
  tx: Prisma.TransactionClient,
  input: Omit<SubmitClientSelectionInput, 'tx'>,
  approvedIds: string[],
  dependencies: SubmitClientSelectionDependencies
): Promise<SubmitClientSelectionResult> {
  const [actor, request, batch] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.actor.id },
      select: {
        id: true,
        role: true,
        status: true,
        clientProfile: { select: { id: true } },
        companyMemberships: { select: { companyId: true } }
      }
    }),
    tx.request.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        requestNumber: true,
        status: true,
        clientId: true,
        companyId: true
      }
    }),
    tx.requestSelectionBatch.findUnique({
      where: { id: input.batchId },
      select: {
        id: true,
        requestId: true,
        revision: true,
        status: true,
        items: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: { id: true, status: true }
        }
      }
    })
  ]);

  if (!actor) throw submissionError('ACTOR_NOT_FOUND', input);
  if (actor.role !== 'CLIENT' || actor.status !== 'ACTIVE' || !actor.clientProfile) {
    throw submissionError('ACTOR_NOT_ALLOWED', input);
  }
  if (!request) throw submissionError('REQUEST_NOT_FOUND', input);
  if (!actorCanAccessRequest(actor, request)) {
    throw submissionError('REQUEST_ACCESS_DENIED', input);
  }
  if (!batch || batch.requestId !== request.id) {
    throw submissionError('BATCH_NOT_FOUND', input);
  }
  if (batch.revision !== input.expectedRevision) {
    throw submissionError('STALE_SELECTION_REVISION', input);
  }
  if (batch.items.length === 0) {
    throw submissionError('EMPTY_BATCH', input);
  }

  const batchItemIds = new Set(batch.items.map((item) => item.id));
  if (approvedIds.some((id) => !batchItemIds.has(id))) {
    throw submissionError('UNKNOWN_BATCH_ITEM_ID', input);
  }

  const persistedApprovedIds = batch.items
    .filter((item) => item.status === 'APPROVED')
    .map((item) => item.id)
    .sort();
  const finalizedBatchStatus =
    batch.status === 'APPROVED'
    || batch.status === 'PARTIALLY_APPROVED'
    || batch.status === 'REJECTED'
      ? batch.status
      : null;

  if (finalizedBatchStatus) {
    const approvedCount = persistedApprovedIds.length;
    const rejectedCount = batch.items.filter(
      (item) => item.status === 'REJECTED'
    ).length;
    const internallyConsistent =
      approvedCount + rejectedCount === batch.items.length
      && finalizedBatchStatus === expectedBatchStatus(approvedCount, batch.items.length);
    if (internallyConsistent && sameIds(persistedApprovedIds, approvedIds)) {
      return {
        outcome: 'noop',
        reason: 'identical_submission',
        batchStatus: finalizedBatchStatus,
        requestStatus: request.status,
        totalCount: batch.items.length,
        approvedCount,
        rejectedCount
      };
    }
    throw submissionError('SUBMISSION_CONFLICT', input);
  }

  if (batch.status !== 'SENT') {
    throw submissionError(
      batch.status === 'SUPERSEDED'
        ? 'STALE_SELECTION_REVISION'
        : 'BATCH_NOT_ACTIVE',
      input
    );
  }
  if (
    request.status !== 'WAITING_APPROVAL'
    && request.status !== 'AWAITING_INVOICE'
  ) {
    throw submissionError('REQUEST_STATUS_DOES_NOT_ALLOW_SUBMISSION', input);
  }

  const activeBatches = await tx.requestSelectionBatch.findMany({
    where: { requestId: request.id, status: 'SENT' },
    orderBy: [{ revision: 'desc' }, { id: 'asc' }],
    take: 2,
    select: { id: true, revision: true }
  });
  if (
    activeBatches.length !== 1
    || activeBatches[0].id !== batch.id
    || activeBatches[0].revision !== input.expectedRevision
  ) {
    throw submissionError('STALE_SELECTION_REVISION', input);
  }

  if (batch.items.some((item) => item.status !== 'PENDING')) {
    throw submissionError('CONCURRENT_SUBMISSION', input);
  }

  const approvedIdSet = new Set(approvedIds);
  const rejectedIds = batch.items
    .map((item) => item.id)
    .filter((id) => !approvedIdSet.has(id));
  const now = new Date();
  const approvedUpdate = approvedIds.length === 0
    ? { count: 0 }
    : await tx.requestSelectionBatchItem.updateMany({
        where: {
          batchId: batch.id,
          id: { in: approvedIds },
          status: 'PENDING'
        },
        data: {
          status: 'APPROVED',
          decisionByUserId: actor.id,
          approvedAt: now,
          rejectedAt: null,
          clientComment: null
        }
      });
  const rejectedUpdate = rejectedIds.length === 0
    ? { count: 0 }
    : await tx.requestSelectionBatchItem.updateMany({
        where: {
          batchId: batch.id,
          id: { in: rejectedIds },
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED',
          decisionByUserId: actor.id,
          approvedAt: null,
          rejectedAt: now,
          clientComment: null
        }
      });

  if (
    approvedUpdate.count !== approvedIds.length
    || rejectedUpdate.count !== rejectedIds.length
  ) {
    throw submissionError('CONCURRENT_SUBMISSION', input);
  }

  const totalCount = batch.items.length;
  const approvedCount = approvedIds.length;
  const rejectedCount = rejectedIds.length;
  const batchStatus = expectedBatchStatus(approvedCount, totalCount);
  const batchEvent =
    batchStatus === 'APPROVED'
      ? 'APPROVE'
      : batchStatus === 'PARTIALLY_APPROVED'
        ? 'PARTIALLY_APPROVE'
        : 'REJECT';

  let batchTransition;
  try {
    batchTransition = await dependencies.transitionBatch({
      batchId: batch.id,
      event: batchEvent,
      actor: input.actor,
      source: input.source ?? 'CLIENT_CABINET',
      requestContext: input.requestContext,
      aggregate: { totalCount, approvedCount, rejectedCount },
      tx
    });
  } catch (error) {
    if (error instanceof RequestSelectionBatchError) {
      throw submissionError('BATCH_TRANSITION_FAILED', input, error);
    }
    throw error;
  }
  if (batchTransition.outcome !== 'changed') {
    throw submissionError('BATCH_TRANSITION_FAILED', input);
  }

  const requestStatus =
    batchStatus === 'REJECTED' ? 'CANCELLED' as const : 'AWAITING_INVOICE' as const;
  let requestTransition;
  try {
    requestTransition = await dependencies.transitionRequest({
      requestId: request.id,
      event:
        batchStatus === 'REJECTED'
          ? REQUEST_STATUS_EVENTS.CLIENT_SELECTION_REJECTED_ALL
          : REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED,
      actor: input.actor,
      tx,
      requestContext: input.requestContext,
      reason:
        batchStatus === 'REJECTED'
          ? 'Клієнт не погодив жодної позиції актуальної версії підбору'
          : batchStatus === 'PARTIALLY_APPROVED'
            ? 'Клієнт частково погодив актуальну версію підбору'
            : 'Клієнт погодив усі позиції актуальної версії підбору',
      metadata: {
        source: 'CLIENT_CABINET',
        batchId: batch.id,
        revision: batch.revision,
        totalCount,
        approvedCount,
        rejectedCount,
        partial: batchStatus === 'PARTIALLY_APPROVED'
      }
    });
  } catch (error) {
    if (error instanceof RequestStatusTransitionError) {
      throw submissionError('REQUEST_STATUS_TRANSITION_FAILED', input, error);
    }
    throw error;
  }

  const persistedRequest = await tx.request.findUnique({
    where: { id: request.id },
    select: { status: true }
  });
  if (
    !persistedRequest
    || !requestReachedTarget(
      requestTransition,
      persistedRequest.status,
      requestStatus
    )
  ) {
    throw submissionError('FINALIZATION_INVARIANT_FAILED', input);
  }

  let aggregateAudit;
  try {
    aggregateAudit = await dependencies.writeAudit(tx, {
      actor: auditUserActor(actor.id),
      companyId: request.companyId,
      entityType: 'REQUEST_SELECTION_BATCH',
      entityId: batch.id,
      entityLabel: `Погодження ${request.requestNumber} · ревізія ${batch.revision}`,
      action: 'REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED',
      category: 'STANDARD',
      metadata: {
        event: 'CLIENT_SELECTION_SUBMITTED',
        source: input.source ?? 'CLIENT_CABINET',
        requestId: request.id,
        batchId: batch.id,
        revision: batch.revision,
        totalItems: totalCount,
        approvedItems: approvedCount,
        rejectedItems: rejectedCount,
        batchResult: batchStatus,
        requestResult: requestStatus
      },
      allowedFields: {
        metadata: [
          'event',
          'source',
          'requestId',
          'batchId',
          'revision',
          'totalItems',
          'approvedItems',
          'rejectedItems',
          'batchResult',
          'requestResult'
        ]
      },
      requestContext: input.requestContext
    });
  } catch (error) {
    throw submissionError('AUDIT_WRITE_FAILED', input, error);
  }

  return {
    outcome: 'changed',
    batchStatus,
    requestStatus,
    totalCount,
    approvedCount,
    rejectedCount,
    auditLogId: aggregateAudit.id
  };
}

export function createSubmitClientSelectionService(
  database: TransactionRunner,
  dependencies: SubmitClientSelectionDependencies = defaultDependencies
) {
  return async function submitClientSelection(
    input: SubmitClientSelectionInput
  ): Promise<SubmitClientSelectionResult> {
    const approvedIds = normalizeApprovedIds(
      input.approvedBatchItemIds,
      input
    );
    const { tx, ...submissionInput } = input;
    if (tx) {
      return executeClientSelectionSubmission(
        tx,
        submissionInput,
        approvedIds,
        dependencies
      );
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await database.$transaction(
          (transaction) =>
            executeClientSelectionSubmission(
              transaction,
              submissionInput,
              approvedIds,
              dependencies
            ),
          transactionOptions
        );
      } catch (error) {
        if (error instanceof SubmitClientSelectionError) throw error;
        if (databaseErrorCode(error) === 'P2034' && attempt === 0) continue;
        throw submissionError('DATABASE_TRANSACTION_FAILED', input, error);
      }
    }
    throw submissionError('DATABASE_TRANSACTION_FAILED', input);
  };
}

export const submitClientSelection =
  createSubmitClientSelectionService(prisma);
