import type { Prisma, RequestSelectionBatchItemStatus } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';

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
  type RequestStatusTransitionResult,
  transitionRequestStatus
} from '@/lib/requests/status-transition';

export const CLIENT_SELECTION_DECISIONS = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT'
} as const;

export type ClientSelectionDecision =
  (typeof CLIENT_SELECTION_DECISIONS)[keyof typeof CLIENT_SELECTION_DECISIONS];

export type DecideClientSelectionItemInput = {
  requestId: string;
  batchId: string;
  batchItemId: string;
  expectedRevision: number;
  decision: ClientSelectionDecision;
  clientComment?: string | null;
  actor: { id: string };
  source?: AuditSource;
  requestContext?: AuditRequestContext;
  tx?: Prisma.TransactionClient;
};

export type ClientSelectionDecisionErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ACTOR_NOT_FOUND'
  | 'ACTOR_NOT_ALLOWED'
  | 'REQUEST_ACCESS_DENIED'
  | 'BATCH_NOT_FOUND'
  | 'BATCH_ITEM_NOT_FOUND'
  | 'BATCH_NOT_ACTIVE'
  | 'STALE_SELECTION_REVISION'
  | 'REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION'
  | 'BATCH_ITEM_ALREADY_DECIDED'
  | 'BATCH_ITEM_DECISION_CONFLICT'
  | 'REJECTION_COMMENT_REQUIRED'
  | 'REJECTION_COMMENT_INVALID'
  | 'BATCH_TRANSITION_FAILED'
  | 'REQUEST_STATUS_TRANSITION_FAILED'
  | 'REQUEST_APPROVAL_FINALIZATION_INVARIANT_FAILED'
  | 'CONCURRENT_SELECTION_DECISION'
  | 'DATABASE_TRANSACTION_FAILED';

export class ClientSelectionDecisionError extends Error {
  constructor(
    readonly code: ClientSelectionDecisionErrorCode,
    readonly context: {
      requestId: string;
      batchId?: string;
      batchItemId?: string;
      expectedRevision?: number;
    },
    options?: ErrorOptions
  ) {
    super(`Client selection decision failed: ${code}.`, options);
    this.name = 'ClientSelectionDecisionError';
  }
}

export type ClientSelectionDecisionResult =
  | {
      outcome: 'changed';
      decision: ClientSelectionDecision;
      itemStatus: RequestSelectionBatchItemStatus;
      batchOutcome: 'unchanged' | 'approved' | 'partially_approved' | 'rejected';
      requestOutcome: 'unchanged' | 'awaiting_invoice';
      auditLogId: string;
    }
  | {
      outcome: 'noop';
      decision: ClientSelectionDecision;
      itemStatus: RequestSelectionBatchItemStatus;
      reason: 'same_decision';
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

type ClientSelectionDecisionDependencies = {
  transitionRequestStatus: typeof transitionRequestStatus;
};

const defaultDependencies: ClientSelectionDecisionDependencies = {
  transitionRequestStatus
};

function decisionError(
  code: ClientSelectionDecisionErrorCode,
  input: Pick<
    DecideClientSelectionItemInput,
    'requestId' | 'batchId' | 'batchItemId' | 'expectedRevision'
  >,
  cause?: unknown
) {
  return new ClientSelectionDecisionError(
    code,
    {
      requestId: input.requestId,
      batchId: input.batchId,
      batchItemId: input.batchItemId,
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

export function requestApprovalTransitionReachedTarget(
  transition: RequestStatusTransitionResult,
  persistedStatus: string
) {
  const transitionReachedTarget =
    (
      transition.outcome === 'changed'
      && transition.nextStatus === 'AWAITING_INVOICE'
    )
    || (
      transition.outcome === 'noop'
      && transition.currentStatus === 'AWAITING_INVOICE'
    );

  return transitionReachedTarget && persistedStatus === 'AWAITING_INVOICE';
}

export function parseClientSelectionComment(
  decision: ClientSelectionDecision,
  value: string | null | undefined
) {
  const comment = value?.trim() ?? '';
  if (decision === CLIENT_SELECTION_DECISIONS.REJECT && comment.length === 0) {
    throw new ClientSelectionDecisionError('REJECTION_COMMENT_REQUIRED', {
      requestId: ''
    });
  }
  if (comment.length === 0) return null;
  if (
    comment.length < (decision === CLIENT_SELECTION_DECISIONS.REJECT ? 3 : 1)
    || comment.length > 500
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(comment)
    || sanitizeHtml(comment, { allowedTags: [], allowedAttributes: {} }) !== comment
  ) {
    throw new ClientSelectionDecisionError('REJECTION_COMMENT_INVALID', {
      requestId: ''
    });
  }
  return comment;
}

function sameDecisionStatus(
  status: RequestSelectionBatchItemStatus,
  decision: ClientSelectionDecision
) {
  return (
    (status === 'APPROVED' && decision === CLIENT_SELECTION_DECISIONS.APPROVE)
    || (status === 'REJECTED' && decision === CLIENT_SELECTION_DECISIONS.REJECT)
  );
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

async function executeClientSelectionDecision(
  tx: Prisma.TransactionClient,
  input: Omit<DecideClientSelectionItemInput, 'tx'>,
  comment: string | null,
  dependencies: ClientSelectionDecisionDependencies
): Promise<ClientSelectionDecisionResult> {
  const [actor, request, batch, item] = await Promise.all([
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
      select: { id: true, requestId: true, revision: true, status: true }
    }),
    tx.requestSelectionBatchItem.findUnique({
      where: { id: input.batchItemId },
      select: { id: true, batchId: true, status: true }
    })
  ]);

  if (!actor) throw decisionError('ACTOR_NOT_FOUND', input);
  if (actor.role !== 'CLIENT' || actor.status !== 'ACTIVE' || !actor.clientProfile) {
    throw decisionError('ACTOR_NOT_ALLOWED', input);
  }
  if (!request) throw decisionError('REQUEST_NOT_FOUND', input);
  if (!actorCanAccessRequest(actor, request)) {
    throw decisionError('REQUEST_ACCESS_DENIED', input);
  }
  if (!batch || batch.requestId !== request.id) {
    throw decisionError('BATCH_NOT_FOUND', input);
  }
  if (!item || item.batchId !== batch.id) {
    throw decisionError('BATCH_ITEM_NOT_FOUND', input);
  }
  if (batch.revision !== input.expectedRevision) {
    throw decisionError('STALE_SELECTION_REVISION', input);
  }

  if (sameDecisionStatus(item.status, input.decision)) {
    const compatibleFinalState =
      batch.status === 'SENT'
      || (batch.status === 'APPROVED' && item.status === 'APPROVED')
      || (
        batch.status === 'PARTIALLY_APPROVED'
        && (item.status === 'APPROVED' || item.status === 'REJECTED')
      )
      || (batch.status === 'REJECTED' && item.status === 'REJECTED');
    if (compatibleFinalState) {
      return {
        outcome: 'noop',
        decision: input.decision,
        itemStatus: item.status,
        reason: 'same_decision'
      };
    }
  }
  if (item.status !== 'PENDING') {
    throw decisionError('BATCH_ITEM_DECISION_CONFLICT', input);
  }

  if (batch.status !== 'SENT') {
    throw decisionError(
      batch.status === 'SUPERSEDED'
        ? 'STALE_SELECTION_REVISION'
        : 'BATCH_NOT_ACTIVE',
      input
    );
  }
  if (request.status !== 'WAITING_APPROVAL') {
    throw decisionError('REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION', input);
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
    throw decisionError('STALE_SELECTION_REVISION', input);
  }

  const now = new Date();
  const itemStatus =
    input.decision === CLIENT_SELECTION_DECISIONS.APPROVE ? 'APPROVED' : 'REJECTED';
  const updated = await tx.requestSelectionBatchItem.updateMany({
    where: { id: item.id, batchId: batch.id, status: 'PENDING' },
    data: {
      status: itemStatus,
      decisionByUserId: actor.id,
      approvedAt: itemStatus === 'APPROVED' ? now : null,
      rejectedAt: itemStatus === 'REJECTED' ? now : null,
      clientComment: comment
    }
  });

  if (updated.count !== 1) {
    const latest = await tx.requestSelectionBatchItem.findUnique({
      where: { id: item.id },
      select: { batchId: true, status: true }
    });
    if (latest?.batchId === batch.id && sameDecisionStatus(latest.status, input.decision)) {
      return {
        outcome: 'noop',
        decision: input.decision,
        itemStatus: latest.status,
        reason: 'same_decision'
      };
    }
    if (latest && latest.status !== 'PENDING') {
      throw decisionError('BATCH_ITEM_DECISION_CONFLICT', input);
    }
    throw decisionError('CONCURRENT_SELECTION_DECISION', input);
  }

  const itemAudit = await writeAuditLog(tx, {
    actor: auditUserActor(actor.id),
    companyId: request.companyId,
    entityType: 'REQUEST_SELECTION_BATCH_ITEM',
    entityId: item.id,
    entityLabel: `Позиція погодження ${request.requestNumber} · ревізія ${batch.revision}`,
    action:
      itemStatus === 'APPROVED'
        ? 'REQUEST_SELECTION_ITEM_APPROVED'
        : 'REQUEST_SELECTION_ITEM_REJECTED',
    category: 'STANDARD',
    oldValue: { status: 'PENDING' },
    newValue: { status: itemStatus },
    metadata: {
      source: input.source ?? 'CLIENT_CABINET',
      requestId: request.id,
      batchId: batch.id,
      revision: batch.revision,
      decision: input.decision,
      hasComment: comment !== null
    },
    allowedFields: {
      oldValue: ['status'],
      newValue: ['status'],
      metadata: [
        'source',
        'requestId',
        'batchId',
        'revision',
        'decision',
        'hasComment'
      ]
    },
    requestContext: input.requestContext
  });

  const aggregate = await tx.requestSelectionBatchItem.groupBy({
    by: ['status'],
    where: { batchId: batch.id },
    _count: { _all: true }
  });
  const counts = new Map(aggregate.map((entry) => [entry.status, entry._count._all]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const pendingCount = counts.get('PENDING') ?? 0;
  const approvedCount = counts.get('APPROVED') ?? 0;
  const rejectedCount = counts.get('REJECTED') ?? 0;
  if (pendingCount > 0) {
    return {
      outcome: 'changed',
      decision: input.decision,
      itemStatus,
      batchOutcome: 'unchanged',
      requestOutcome: 'unchanged',
      auditLogId: itemAudit.id
    };
  }

  const batchEvent =
    approvedCount === total
      ? 'APPROVE'
      : approvedCount > 0 && rejectedCount > 0
        ? 'PARTIALLY_APPROVE'
        : 'REJECT';
  const batchTransition = await transitionRequestSelectionBatchStatus({
    batchId: batch.id,
    event: batchEvent,
    actor: input.actor,
    source: input.source ?? 'CLIENT_CABINET',
    requestContext: input.requestContext,
    aggregate: {
      totalCount: total,
      approvedCount,
      rejectedCount
    },
    tx
  });
  if (batchTransition.outcome !== 'changed' && batchTransition.outcome !== 'noop') {
    throw decisionError('BATCH_TRANSITION_FAILED', input);
  }

  if (batchEvent !== 'REJECT') {
    let requestTransition;
    try {
      const partial = batchEvent === 'PARTIALLY_APPROVE';
      requestTransition = await dependencies.transitionRequestStatus({
        requestId: request.id,
        event: REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED,
        actor: input.actor,
        tx,
        requestContext: input.requestContext,
        reason: partial
          ? 'Клієнт частково погодив актуальну версію підбору'
          : 'Клієнт погодив усі позиції актуальної версії підбору',
        metadata: {
          source: 'CLIENT_CABINET',
          batchId: batch.id,
          revision: batch.revision,
          totalCount: total,
          approvedCount,
          rejectedCount,
          partial
        }
      });
    } catch (error) {
      if (error instanceof RequestStatusTransitionError) {
        throw decisionError('REQUEST_STATUS_TRANSITION_FAILED', input, error);
      }
      throw error;
    }
    const persistedRequest = await tx.request.findUnique({
      where: { id: request.id },
      select: { status: true }
    });
    if (
      !persistedRequest
      || !requestApprovalTransitionReachedTarget(
        requestTransition,
        persistedRequest.status
      )
    ) {
      throw decisionError(
        'REQUEST_APPROVAL_FINALIZATION_INVARIANT_FAILED',
        input
      );
    }
  }

  return {
    outcome: 'changed',
    decision: input.decision,
    itemStatus,
    batchOutcome:
      batchEvent === 'APPROVE'
        ? 'approved'
        : batchEvent === 'PARTIALLY_APPROVE'
          ? 'partially_approved'
          : 'rejected',
    requestOutcome: batchEvent === 'REJECT' ? 'unchanged' : 'awaiting_invoice',
    auditLogId: itemAudit.id
  };
}

export function createClientSelectionDecisionService(
  database: TransactionRunner,
  dependencies: ClientSelectionDecisionDependencies = defaultDependencies
) {
  return async function decideClientSelectionItem(
    input: DecideClientSelectionItemInput
  ): Promise<ClientSelectionDecisionResult> {
    let comment: string | null;
    try {
      comment = parseClientSelectionComment(input.decision, input.clientComment);
    } catch (error) {
      if (error instanceof ClientSelectionDecisionError) {
        throw decisionError(error.code, input, error);
      }
      throw error;
    }

    const { tx, ...decisionInput } = input;
    if (tx) {
      return executeClientSelectionDecision(
        tx,
        decisionInput,
        comment,
        dependencies
      );
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await database.$transaction(
          (transaction) =>
            executeClientSelectionDecision(
              transaction,
              decisionInput,
              comment,
              dependencies
            ),
          {
            maxWait: 5_000,
            timeout: 10_000,
            isolationLevel: 'Serializable'
          }
        );
      } catch (error) {
        if (error instanceof ClientSelectionDecisionError) throw error;
        if (error instanceof RequestSelectionBatchError) {
          throw decisionError('BATCH_TRANSITION_FAILED', input, error);
        }
        if (error instanceof RequestStatusTransitionError) {
          throw decisionError('REQUEST_STATUS_TRANSITION_FAILED', input, error);
        }
        if (databaseErrorCode(error) === 'P2034' && attempt === 0) continue;
        throw decisionError(
          databaseErrorCode(error) === 'P2034'
            ? 'CONCURRENT_SELECTION_DECISION'
            : 'DATABASE_TRANSACTION_FAILED',
          input,
          error
        );
      }
    }
    throw decisionError('CONCURRENT_SELECTION_DECISION', input);
  };
}

export const decideClientSelectionItem =
  createClientSelectionDecisionService(prisma);
