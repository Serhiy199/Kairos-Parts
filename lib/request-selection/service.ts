import type {
  Prisma,
  RequestSelectionBatchStatus,
  RequestStatus,
  UserRole
} from '@prisma/client';

import type { AuditRequestContext, AuditSource } from '@/lib/audit-log/contracts';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import {
  REQUEST_SELECTION_BATCH_EVENTS,
  resolveRequestSelectionBatchTransition,
  type RequestSelectionBatchEvent,
  type RequestSelectionBatchTransitionDecision
} from '@/lib/request-selection/lifecycle';
import {
  buildRequestSelectionSnapshot,
  hashRequestSelectionBatchSnapshots,
  REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION,
  RequestSelectionSnapshotError,
  type RequestSelectionSnapshotSource
} from '@/lib/request-selection/snapshot';

const staffRoles = new Set<UserRole>(['ADMIN', 'MANAGER']);
const terminalRequestStatuses = new Set<RequestStatus>(['COMPLETED', 'CANCELLED']);
const auditActionByEvent = {
  SEND: 'REQUEST_SELECTION_BATCH_SENT',
  APPROVE: 'REQUEST_SELECTION_BATCH_APPROVED',
  REJECT: 'REQUEST_SELECTION_BATCH_REJECTED',
  SUPERSEDE: 'REQUEST_SELECTION_BATCH_SUPERSEDED'
} as const satisfies Record<RequestSelectionBatchEvent, Prisma.AuditLogCreateInput['action']>;

export type RequestSelectionActor = {
  id: string;
};

export type ExpectedRequestItemVersion = {
  id: string;
  updatedAt: Date;
};

export type CreateRequestSelectionBatchInput = {
  requestId: string;
  requestItemIds: string[];
  actor: RequestSelectionActor;
  expectedRequestItemVersions?: ExpectedRequestItemVersion[];
  source?: AuditSource;
  requestContext?: AuditRequestContext;
  tx?: Prisma.TransactionClient;
};

export type CreateRequestSelectionBatchResult = {
  batchId: string;
  requestId: string;
  revision: number;
  status: 'DRAFT';
  itemCount: number;
  snapshotSchemaVersion: number;
  snapshotHash: string;
  auditLogId: string;
};

export type TransitionRequestSelectionBatchInput = {
  batchId: string;
  event: RequestSelectionBatchEvent;
  actor: RequestSelectionActor;
  source?: AuditSource;
  requestContext?: AuditRequestContext;
  tx?: Prisma.TransactionClient;
};

export type RequestSelectionBatchTransitionResult =
  | {
      outcome: 'changed';
      previousStatus: RequestSelectionBatchStatus;
      nextStatus: RequestSelectionBatchStatus;
      auditLogId: string;
    }
  | Exclude<RequestSelectionBatchTransitionDecision, { outcome: 'allowed' }>
  | {
      outcome: 'blocked';
      currentStatus: RequestSelectionBatchStatus;
      reason: 'empty_batch' | 'items_not_fully_approved' | 'no_rejected_items';
    };

export type RequestSelectionBatchErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ACTOR_NOT_FOUND'
  | 'ACTOR_NOT_ALLOWED'
  | 'EMPTY_SELECTION'
  | 'DUPLICATE_REQUEST_ITEM_IDS'
  | 'REQUEST_ITEM_NOT_FOUND'
  | 'REQUEST_ITEM_NOT_IN_REQUEST'
  | 'REQUEST_TERMINAL'
  | 'SOURCE_ITEM_INVALID'
  | 'SOURCE_ITEM_CHANGED'
  | 'REVISION_ALLOCATION_FAILED'
  | 'ACTIVE_SENT_BATCH_CONFLICT'
  | 'SNAPSHOT_BUILD_FAILED'
  | 'BATCH_CREATE_FAILED'
  | 'BATCH_NOT_FOUND'
  | 'CONCURRENT_BATCH_STATUS_CHANGE';

export class RequestSelectionBatchError extends Error {
  constructor(
    readonly code: RequestSelectionBatchErrorCode,
    readonly context: {
      requestId?: string;
      batchId?: string;
      requestItemId?: string;
      event?: RequestSelectionBatchEvent;
    },
    options?: ErrorOptions
  ) {
    super(`Request selection batch operation failed: ${code}.`, options);
    this.name = 'RequestSelectionBatchError';
  }
}

type TransactionRunner = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

const sourceItemSelect = {
  id: true,
  requestId: true,
  updatedAt: true,
  equipmentType: true,
  name: true,
  brand: true,
  catalogNumber: true,
  analogNumber: true,
  quantity: true,
  unit: true,
  availability: true,
  deliveryTime: true,
  salePrice: true,
  currency: true,
  comment: true,
  vehicleId: true,
  vehicle: {
    select: {
      id: true,
      name: true,
      manufacturer: true,
      model: true,
      year: true,
      vinOrSerial: true
    }
  }
} satisfies Prisma.RequestItemSelect;

type SourceItemRecord = Prisma.RequestItemGetPayload<{ select: typeof sourceItemSelect }>;

function isDatabaseErrorCode(error: unknown, code: string) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === code
  );
}

function roleAllowedForEvent(role: UserRole, event: RequestSelectionBatchEvent) {
  if (
    event === REQUEST_SELECTION_BATCH_EVENTS.APPROVE
    || event === REQUEST_SELECTION_BATCH_EVENTS.REJECT
  ) {
    return role === 'CLIENT';
  }
  return staffRoles.has(role);
}

function assertUniqueSelection(requestItemIds: string[], requestId: string) {
  if (requestItemIds.length === 0) {
    throw new RequestSelectionBatchError('EMPTY_SELECTION', { requestId });
  }
  if (new Set(requestItemIds).size !== requestItemIds.length) {
    throw new RequestSelectionBatchError('DUPLICATE_REQUEST_ITEM_IDS', { requestId });
  }
}

function assertExpectedVersions(
  sourceItems: SourceItemRecord[],
  expectedVersions: ExpectedRequestItemVersion[] | undefined,
  requestId: string
) {
  if (!expectedVersions) return;
  const expectedById = new Map(expectedVersions.map((entry) => [entry.id, entry.updatedAt]));

  for (const item of sourceItems) {
    const expected = expectedById.get(item.id);
    if (!expected || expected.getTime() !== item.updatedAt.getTime()) {
      throw new RequestSelectionBatchError('SOURCE_ITEM_CHANGED', {
        requestId,
        requestItemId: item.id
      });
    }
  }
}

function toSnapshotSource(item: SourceItemRecord): RequestSelectionSnapshotSource {
  return item;
}

async function executeCreateRequestSelectionBatch(
  tx: Prisma.TransactionClient,
  input: Omit<CreateRequestSelectionBatchInput, 'tx'>
): Promise<CreateRequestSelectionBatchResult> {
  assertUniqueSelection(input.requestItemIds, input.requestId);

  const [request, actor, sourceItems] = await Promise.all([
    tx.request.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        requestNumber: true,
        companyId: true,
        status: true
      }
    }),
    tx.user.findUnique({
      where: { id: input.actor.id },
      select: { id: true, role: true, status: true }
    }),
    tx.requestItem.findMany({
      where: { id: { in: input.requestItemIds } },
      select: sourceItemSelect
    })
  ]);

  if (!request) {
    throw new RequestSelectionBatchError('REQUEST_NOT_FOUND', { requestId: input.requestId });
  }
  if (!actor) {
    throw new RequestSelectionBatchError('ACTOR_NOT_FOUND', { requestId: input.requestId });
  }
  if (actor.status !== 'ACTIVE' || !staffRoles.has(actor.role)) {
    throw new RequestSelectionBatchError('ACTOR_NOT_ALLOWED', { requestId: input.requestId });
  }
  if (terminalRequestStatuses.has(request.status)) {
    throw new RequestSelectionBatchError('REQUEST_TERMINAL', { requestId: input.requestId });
  }

  const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
  for (const requestItemId of input.requestItemIds) {
    const item = sourceById.get(requestItemId);
    if (!item) {
      throw new RequestSelectionBatchError('REQUEST_ITEM_NOT_FOUND', {
        requestId: input.requestId,
        requestItemId
      });
    }
    if (item.requestId !== request.id) {
      throw new RequestSelectionBatchError('REQUEST_ITEM_NOT_IN_REQUEST', {
        requestId: input.requestId,
        requestItemId
      });
    }
  }

  const orderedItems = input.requestItemIds.map((id) => sourceById.get(id)!);
  assertExpectedVersions(orderedItems, input.expectedRequestItemVersions, request.id);

  let snapshots;
  try {
    snapshots = orderedItems.map((item) => buildRequestSelectionSnapshot(toSnapshotSource(item)));
  } catch (error) {
    if (error instanceof RequestSelectionSnapshotError) {
      throw new RequestSelectionBatchError(
        'SOURCE_ITEM_INVALID',
        { requestId: request.id, requestItemId: error.sourceRequestItemId },
        { cause: error }
      );
    }
    throw new RequestSelectionBatchError(
      'SNAPSHOT_BUILD_FAILED',
      { requestId: request.id },
      { cause: error }
    );
  }

  let revision: number;
  try {
    const allocated = await tx.request.update({
      where: { id: request.id },
      data: { selectionRevisionCounter: { increment: 1 } },
      select: { selectionRevisionCounter: true }
    });
    revision = allocated.selectionRevisionCounter;
  } catch (error) {
    throw new RequestSelectionBatchError(
      'REVISION_ALLOCATION_FAILED',
      { requestId: request.id },
      { cause: error }
    );
  }

  const positionedSnapshots = snapshots.map((snapshot, index) => ({
    position: index + 1,
    snapshot
  }));
  const batchSnapshotHash = hashRequestSelectionBatchSnapshots(
    positionedSnapshots.map(({ position, snapshot }) => ({
      position,
      snapshotHash: snapshot.snapshotHash
    }))
  );

  let batch: { id: string };
  try {
    batch = await tx.requestSelectionBatch.create({
      data: {
        requestId: request.id,
        revision,
        status: 'DRAFT',
        snapshotSchemaVersion: REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION,
        snapshotHash: batchSnapshotHash,
        createdByUserId: actor.id
      },
      select: { id: true }
    });

    for (const { position, snapshot } of positionedSnapshots) {
      await tx.requestSelectionBatchItem.create({
        data: {
          batchId: batch.id,
          position,
          status: 'PENDING',
          ...snapshot
        },
        select: { id: true }
      });
    }
  } catch (error) {
    throw new RequestSelectionBatchError(
      'BATCH_CREATE_FAILED',
      { requestId: request.id },
      { cause: error }
    );
  }

  const auditLog = await writeAuditLog(tx, {
    actor: auditUserActor(actor.id),
    companyId: request.companyId,
    entityType: 'REQUEST_SELECTION_BATCH',
    entityId: batch.id,
    entityLabel: `Погодження ${request.requestNumber} · ревізія ${revision}`,
    action: 'REQUEST_SELECTION_BATCH_CREATED',
    category: 'STANDARD',
    newValue: {
      requestId: request.id,
      revision,
      status: 'DRAFT',
      itemCount: snapshots.length,
      snapshotSchemaVersion: REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION
    },
    metadata: {
      source: input.source ?? 'SYSTEM',
      requestId: request.id,
      sourceRequestItemIds: input.requestItemIds.slice(0, 50),
      snapshotCount: snapshots.length,
      businessEvent: 'REQUEST_SELECTION_BATCH_CREATED'
    },
    allowedFields: {
      newValue: ['requestId', 'revision', 'status', 'itemCount', 'snapshotSchemaVersion'],
      metadata: [
        'source',
        'requestId',
        'sourceRequestItemIds',
        'snapshotCount',
        'businessEvent'
      ]
    },
    requestContext: input.requestContext
  });

  return {
    batchId: batch.id,
    requestId: request.id,
    revision,
    status: 'DRAFT',
    itemCount: snapshots.length,
    snapshotSchemaVersion: REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION,
    snapshotHash: batchSnapshotHash,
    auditLogId: auditLog.id
  };
}

function transitionTimestampData(
  event: RequestSelectionBatchEvent,
  now: Date
): Prisma.RequestSelectionBatchUpdateManyMutationInput {
  if (event === REQUEST_SELECTION_BATCH_EVENTS.SEND) return { status: 'SENT', sentAt: now };
  if (event === REQUEST_SELECTION_BATCH_EVENTS.APPROVE) {
    return { status: 'APPROVED', approvedAt: now };
  }
  if (event === REQUEST_SELECTION_BATCH_EVENTS.REJECT) {
    return { status: 'REJECTED', rejectedAt: now };
  }
  return { status: 'SUPERSEDED', supersededAt: now };
}

async function aggregateGuard(
  tx: Prisma.TransactionClient,
  batchId: string,
  currentStatus: RequestSelectionBatchStatus,
  event: RequestSelectionBatchEvent
): Promise<RequestSelectionBatchTransitionResult | null> {
  if (event === REQUEST_SELECTION_BATCH_EVENTS.SEND) {
    const itemCount = await tx.requestSelectionBatchItem.count({ where: { batchId } });
    if (itemCount === 0) {
      return { outcome: 'blocked', currentStatus, reason: 'empty_batch' };
    }
  }

  if (event === REQUEST_SELECTION_BATCH_EVENTS.APPROVE) {
    const [itemCount, notApprovedCount] = await Promise.all([
      tx.requestSelectionBatchItem.count({ where: { batchId } }),
      tx.requestSelectionBatchItem.count({
        where: { batchId, status: { not: 'APPROVED' } }
      })
    ]);
    if (itemCount === 0 || notApprovedCount > 0) {
      return { outcome: 'blocked', currentStatus, reason: 'items_not_fully_approved' };
    }
  }

  if (event === REQUEST_SELECTION_BATCH_EVENTS.REJECT) {
    const rejectedCount = await tx.requestSelectionBatchItem.count({
      where: { batchId, status: 'REJECTED' }
    });
    if (rejectedCount === 0) {
      return { outcome: 'blocked', currentStatus, reason: 'no_rejected_items' };
    }
  }

  return null;
}

async function executeTransitionRequestSelectionBatch(
  tx: Prisma.TransactionClient,
  input: Omit<TransitionRequestSelectionBatchInput, 'tx'>
): Promise<RequestSelectionBatchTransitionResult> {
  const [batch, actor] = await Promise.all([
    tx.requestSelectionBatch.findUnique({
      where: { id: input.batchId },
      select: {
        id: true,
        requestId: true,
        revision: true,
        status: true,
        request: {
          select: { requestNumber: true, companyId: true }
        }
      }
    }),
    tx.user.findUnique({
      where: { id: input.actor.id },
      select: { id: true, role: true, status: true }
    })
  ]);

  if (!batch) {
    throw new RequestSelectionBatchError('BATCH_NOT_FOUND', { batchId: input.batchId });
  }
  if (!actor) {
    throw new RequestSelectionBatchError('ACTOR_NOT_FOUND', {
      batchId: batch.id,
      event: input.event
    });
  }
  if (actor.status !== 'ACTIVE' || !roleAllowedForEvent(actor.role, input.event)) {
    throw new RequestSelectionBatchError('ACTOR_NOT_ALLOWED', {
      batchId: batch.id,
      event: input.event
    });
  }

  const decision = resolveRequestSelectionBatchTransition(batch.status, input.event);
  if (decision.outcome !== 'allowed') return decision;

  const aggregateResult = await aggregateGuard(tx, batch.id, batch.status, input.event);
  if (aggregateResult) return aggregateResult;

  let updated: { count: number };
  try {
    updated = await tx.requestSelectionBatch.updateMany({
      where: { id: batch.id, status: batch.status },
      data: transitionTimestampData(input.event, new Date())
    });
  } catch (error) {
    if (isDatabaseErrorCode(error, 'P2002')) {
      throw new RequestSelectionBatchError(
        'ACTIVE_SENT_BATCH_CONFLICT',
        { batchId: batch.id, event: input.event },
        { cause: error }
      );
    }
    throw error;
  }

  if (updated.count !== 1) {
    const latest = await tx.requestSelectionBatch.findUnique({
      where: { id: batch.id },
      select: { status: true }
    });
    if (!latest) {
      throw new RequestSelectionBatchError('BATCH_NOT_FOUND', {
        batchId: batch.id,
        event: input.event
      });
    }
    const concurrentDecision = resolveRequestSelectionBatchTransition(latest.status, input.event);
    if (concurrentDecision.outcome !== 'allowed') return concurrentDecision;
    throw new RequestSelectionBatchError('CONCURRENT_BATCH_STATUS_CHANGE', {
      batchId: batch.id,
      event: input.event
    });
  }

  const auditLog = await writeAuditLog(tx, {
    actor: auditUserActor(actor.id),
    companyId: batch.request.companyId,
    entityType: 'REQUEST_SELECTION_BATCH',
    entityId: batch.id,
    entityLabel: `Погодження ${batch.request.requestNumber} · ревізія ${batch.revision}`,
    action: auditActionByEvent[input.event],
    category: 'STANDARD',
    oldValue: { status: batch.status },
    newValue: { status: decision.nextStatus },
    metadata: {
      source: input.source ?? 'SYSTEM',
      requestId: batch.requestId,
      revision: batch.revision,
      event: input.event
    },
    allowedFields: {
      oldValue: ['status'],
      newValue: ['status'],
      metadata: ['source', 'requestId', 'revision', 'event']
    },
    requestContext: input.requestContext
  });

  return {
    outcome: 'changed',
    previousStatus: batch.status,
    nextStatus: decision.nextStatus,
    auditLogId: auditLog.id
  };
}

export function createRequestSelectionBatchService(database: TransactionRunner) {
  return async function createRequestSelectionBatch(
    input: CreateRequestSelectionBatchInput
  ): Promise<CreateRequestSelectionBatchResult> {
    const { tx, ...createInput } = input;
    if (tx) return executeCreateRequestSelectionBatch(tx, createInput);
    return database.$transaction((transaction) =>
      executeCreateRequestSelectionBatch(transaction, createInput)
    );
  };
}

export function createRequestSelectionBatchTransitionService(database: TransactionRunner) {
  return async function transitionRequestSelectionBatchStatus(
    input: TransitionRequestSelectionBatchInput
  ): Promise<RequestSelectionBatchTransitionResult> {
    const { tx, ...transitionInput } = input;
    if (tx) return executeTransitionRequestSelectionBatch(tx, transitionInput);
    return database.$transaction((transaction) =>
      executeTransitionRequestSelectionBatch(transaction, transitionInput)
    );
  };
}

export const createRequestSelectionBatchDraft = createRequestSelectionBatchService(prisma);
export const transitionRequestSelectionBatchStatus =
  createRequestSelectionBatchTransitionService(prisma);
