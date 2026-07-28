import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  Prisma,
  type RequestSelectionBatchItemStatus,
  type RequestSelectionBatchStatus,
  type RequestStatus,
  type UserRole,
  type UserStatus
} from '@prisma/client';

import {
  REQUEST_SELECTION_BATCH_EVENTS,
  resolveRequestSelectionBatchTransition
} from '../lib/request-selection/lifecycle';
import {
  createRequestSelectionBatchService,
  createRequestSelectionBatchTransitionService,
  RequestSelectionBatchError
} from '../lib/request-selection/service';
import {
  buildRequestSelectionSnapshot,
  REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION,
  sha256RequestSelectionSnapshot,
  stableSerializeRequestSelectionSnapshot,
  type RequestSelectionSnapshotSource
} from '../lib/request-selection/snapshot';

const cwd = process.cwd();
const migrationPath = resolve(
  cwd,
  'prisma/migrations/20260727183000_add_request_selection_batch_foundation/migration.sql'
);

function makeSnapshotSource(
  overrides: Partial<RequestSelectionSnapshotSource> = {}
): RequestSelectionSnapshotSource {
  return {
    id: 'item-1',
    updatedAt: new Date('2026-07-27T10:00:00.000Z'),
    equipmentType: 'Трактор',
    name: 'Паливний фільтр',
    brand: 'MANN',
    catalogNumber: 'WK-123',
    analogNumber: 'A-456',
    quantity: 2,
    unit: 'шт',
    availability: 'В наявності',
    deliveryTime: '2 дні',
    salePrice: new Prisma.Decimal('1250.50'),
    currency: 'UAH',
    comment: 'Сумісний із вказаною моделлю',
    vehicleId: 'vehicle-1',
    vehicle: {
      id: 'vehicle-1',
      name: 'John Deere 6155M',
      manufacturer: 'John Deere',
      model: '6155M',
      year: 2021,
      vinOrSerial: 'VIN-SNAPSHOT-ONLY'
    },
    ...overrides
  };
}

const snapshot = buildRequestSelectionSnapshot(makeSnapshotSource());
assert.equal(snapshot.snapshotSchemaVersion, REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION);
assert.equal(snapshot.snapshotSchemaVersion, 1);
assert.equal(snapshot.itemName, 'Паливний фільтр');
assert.equal(snapshot.quantity, 2);
assert.equal(snapshot.approvedUnitPrice?.toString(), '1250.5');
assert.equal(snapshot.vehicleDisplayName, 'John Deere 6155M');
assert.equal(snapshot.sourceUpdatedAt.toISOString(), '2026-07-27T10:00:00.000Z');
assert.match(snapshot.snapshotHash, /^[0-9a-f]{64}$/);
assert.equal(
  snapshot.snapshotHash,
  buildRequestSelectionSnapshot(makeSnapshotSource()).snapshotHash
);

const reorderedLeft = {
  z: new Prisma.Decimal('10.00'),
  a: { y: undefined, x: new Date('2026-01-01T00:00:00.000Z') }
};
const reorderedRight = {
  a: { x: new Date('2026-01-01T00:00:00.000Z'), y: null },
  z: new Prisma.Decimal('10')
};
assert.equal(
  stableSerializeRequestSelectionSnapshot(reorderedLeft),
  stableSerializeRequestSelectionSnapshot(reorderedRight)
);
assert.equal(
  sha256RequestSelectionSnapshot(reorderedLeft),
  sha256RequestSelectionSnapshot(reorderedRight)
);
assert.notEqual(
  snapshot.snapshotHash,
  buildRequestSelectionSnapshot(makeSnapshotSource({ quantity: 3 })).snapshotHash
);
assert.notEqual(
  snapshot.snapshotHash,
  buildRequestSelectionSnapshot(makeSnapshotSource({ catalogNumber: 'WK-999' })).snapshotHash
);
assert.notEqual(
  snapshot.snapshotHash,
  buildRequestSelectionSnapshot({
    ...makeSnapshotSource(),
    vehicle: { ...makeSnapshotSource().vehicle!, vinOrSerial: 'OTHER-VIN' }
  }).snapshotHash
);
assert.notEqual(
  snapshot.snapshotHash,
  buildRequestSelectionSnapshot(
    makeSnapshotSource({ updatedAt: new Date('2026-07-27T10:00:01.000Z') })
  ).snapshotHash
);
assert.equal(
  snapshot.snapshotHash,
  buildRequestSelectionSnapshot({
    ...makeSnapshotSource(),
    status: 'APPROVED',
    generatedBatchItemId: 'ignored-id'
  } as RequestSelectionSnapshotSource).snapshotHash
);
assert.equal('purchasePrice' in snapshot, false);
assert.equal('supplierName' in snapshot, false);
assert.equal('password' in snapshot, false);

assert.deepEqual(resolveRequestSelectionBatchTransition('DRAFT', 'SEND'), {
  outcome: 'allowed',
  nextStatus: 'SENT'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'SEND'), {
  outcome: 'noop',
  currentStatus: 'SENT',
  reason: 'already_in_target_status'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'APPROVE'), {
  outcome: 'allowed',
  nextStatus: 'APPROVED'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'REJECT'), {
  outcome: 'allowed',
  nextStatus: 'REJECTED'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'SUPERSEDE'), {
  outcome: 'allowed',
  nextStatus: 'SUPERSEDED'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('DRAFT', 'SUPERSEDE'), {
  outcome: 'allowed',
  nextStatus: 'SUPERSEDED'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('APPROVED', 'REJECT'), {
  outcome: 'blocked',
  currentStatus: 'APPROVED',
  reason: 'final_status_locked'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('REJECTED', 'SEND'), {
  outcome: 'blocked',
  currentStatus: 'REJECTED',
  reason: 'final_status_locked'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('SUPERSEDED', 'APPROVE'), {
  outcome: 'blocked',
  currentStatus: 'SUPERSEDED',
  reason: 'final_status_locked'
});

type TestUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

type TestRequest = {
  id: string;
  requestNumber: string;
  companyId: string | null;
  status: RequestStatus;
  selectionRevisionCounter: number;
};

type TestSourceItem = RequestSelectionSnapshotSource & { requestId: string };

type TestBatch = {
  id: string;
  requestId: string;
  revision: number;
  status: RequestSelectionBatchStatus;
  snapshotSchemaVersion: number;
  snapshotHash: string;
  createdByUserId: string | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  supersededAt: Date | null;
};

type TestBatchItem = {
  id: string;
  batchId: string;
  sourceRequestItemId: string | null;
  position: number;
  status: RequestSelectionBatchItemStatus;
  snapshotHash: string;
  [key: string]: unknown;
};

type TestState = {
  users: Map<string, TestUser>;
  requests: Map<string, TestRequest>;
  sourceItems: Map<string, TestSourceItem>;
  batches: Map<string, TestBatch>;
  batchItems: Map<string, TestBatchItem>;
  audits: Array<Record<string, unknown>>;
  nextBatchId: number;
  nextBatchItemId: number;
};

type WriterOptions = {
  failBatchCreate?: boolean;
  failBatchItemPosition?: number;
  failAudit?: boolean;
  concurrentBatchStatus?: RequestSelectionBatchStatus;
};

function cloneDate(value: Date | null) {
  return value ? new Date(value) : null;
}

function cloneState(state: TestState): TestState {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    requests: new Map([...state.requests].map(([id, request]) => [id, { ...request }])),
    sourceItems: new Map(
      [...state.sourceItems].map(([id, item]) => [
        id,
        {
          ...item,
          updatedAt: new Date(item.updatedAt),
          salePrice: item.salePrice ? new Prisma.Decimal(item.salePrice) : null,
          vehicle: item.vehicle ? { ...item.vehicle } : null
        }
      ])
    ),
    batches: new Map(
      [...state.batches].map(([id, batch]) => [
        id,
        {
          ...batch,
          sentAt: cloneDate(batch.sentAt),
          approvedAt: cloneDate(batch.approvedAt),
          rejectedAt: cloneDate(batch.rejectedAt),
          supersededAt: cloneDate(batch.supersededAt)
        }
      ])
    ),
    batchItems: new Map(
      [...state.batchItems].map(([id, item]) => [id, { ...item }])
    ),
    audits: state.audits.map((audit) => ({ ...audit })),
    nextBatchId: state.nextBatchId,
    nextBatchItemId: state.nextBatchItemId
  };
}

function commitState(target: TestState, source: TestState) {
  target.users = source.users;
  target.requests = source.requests;
  target.sourceItems = source.sourceItems;
  target.batches = source.batches;
  target.batchItems = source.batchItems;
  target.audits = source.audits;
  target.nextBatchId = source.nextBatchId;
  target.nextBatchItemId = source.nextBatchItemId;
}

function initialState(requestStatus: RequestStatus = 'IN_PROGRESS'): TestState {
  const users = new Map<string, TestUser>([
    ['admin', {
      id: 'admin',
      name: 'Admin User',
      email: 'ADMIN@EXAMPLE.COM',
      role: 'ADMIN',
      status: 'ACTIVE'
    }],
    ['manager', {
      id: 'manager',
      name: 'Manager User',
      email: 'manager@example.com',
      role: 'MANAGER',
      status: 'ACTIVE'
    }],
    ['client', {
      id: 'client',
      name: 'Client User',
      email: 'client@example.com',
      role: 'CLIENT',
      status: 'ACTIVE'
    }],
    ['disabled-manager', {
      id: 'disabled-manager',
      name: 'Disabled Manager',
      email: 'disabled@example.com',
      role: 'MANAGER',
      status: 'DISABLED'
    }]
  ]);
  const sourceOne = { ...makeSnapshotSource(), requestId: 'request-1' };
  const sourceTwo = {
    ...makeSnapshotSource({
      id: 'item-2',
      name: 'Масляний фільтр',
      catalogNumber: 'OF-2'
    }),
    requestId: 'request-1'
  };

  return {
    users,
    requests: new Map([
      ['request-1', {
        id: 'request-1',
        requestNumber: 'KP-1',
        companyId: 'company-1',
        status: requestStatus,
        selectionRevisionCounter: 0
      }],
      ['request-2', {
        id: 'request-2',
        requestNumber: 'KP-2',
        companyId: 'company-2',
        status: 'IN_PROGRESS',
        selectionRevisionCounter: 0
      }]
    ]),
    sourceItems: new Map([
      ['item-1', sourceOne],
      ['item-2', sourceTwo],
      ['foreign-item', {
        ...makeSnapshotSource({ id: 'foreign-item' }),
        requestId: 'request-2'
      }]
    ]),
    batches: new Map(),
    batchItems: new Map(),
    audits: [],
    nextBatchId: 1,
    nextBatchItemId: 1
  };
}

function makeWriter(state: TestState, options: WriterOptions = {}) {
  let concurrentApplied = false;

  return {
    request: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.requests.get(where.id) ?? null,
      update: async ({
        where
      }: {
        where: { id: string };
        data: { selectionRevisionCounter: { increment: number } };
      }) => {
        const request = state.requests.get(where.id);
        if (!request) throw Object.assign(new Error('missing request'), { code: 'P2025' });
        request.selectionRevisionCounter += 1;
        return { selectionRevisionCounter: request.selectionRevisionCounter };
      }
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.users.get(where.id) ?? null
    },
    requestItem: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.flatMap((id) => {
          const item = state.sourceItems.get(id);
          return item ? [item] : [];
        })
    },
    requestSelectionBatch: {
      create: async ({ data }: { data: Omit<TestBatch, 'id' | 'sentAt' | 'approvedAt' | 'rejectedAt' | 'supersededAt'> }) => {
        if (options.failBatchCreate) throw new Error('batch-create-failed');
        if (
          [...state.batches.values()].some(
            (batch) => batch.requestId === data.requestId && batch.revision === data.revision
          )
        ) {
          throw Object.assign(new Error('duplicate revision'), { code: 'P2002' });
        }
        const id = `batch-${state.nextBatchId++}`;
        state.batches.set(id, {
          ...data,
          id,
          sentAt: null,
          approvedAt: null,
          rejectedAt: null,
          supersededAt: null
        });
        return { id };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const batch = state.batches.get(where.id);
        if (!batch) return null;
        const request = state.requests.get(batch.requestId)!;
        return {
          ...batch,
          request: {
            requestNumber: request.requestNumber,
            companyId: request.companyId
          }
        };
      },
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; status: RequestSelectionBatchStatus };
        data: Partial<TestBatch>;
      }) => {
        const batch = state.batches.get(where.id);
        if (!batch) return { count: 0 };
        if (options.concurrentBatchStatus && !concurrentApplied) {
          concurrentApplied = true;
          batch.status = options.concurrentBatchStatus;
          return { count: 0 };
        }
        if (batch.status !== where.status) return { count: 0 };
        if (
          data.status === 'SENT'
          && [...state.batches.values()].some(
            (candidate) =>
              candidate.id !== batch.id
              && candidate.requestId === batch.requestId
              && candidate.status === 'SENT'
          )
        ) {
          throw Object.assign(new Error('active sent conflict'), { code: 'P2002' });
        }
        Object.assign(batch, data);
        return { count: 1 };
      }
    },
    requestSelectionBatchItem: {
      create: async ({ data }: { data: Omit<TestBatchItem, 'id'> }) => {
        if (options.failBatchItemPosition === data.position) {
          throw new Error('batch-item-create-failed');
        }
        const id = `batch-item-${state.nextBatchItemId++}`;
        state.batchItems.set(id, { ...(data as TestBatchItem), id });
        return { id };
      },
      count: async ({
        where
      }: {
        where: {
          batchId: string;
          status?: RequestSelectionBatchItemStatus | { not: RequestSelectionBatchItemStatus };
        };
      }) =>
        [...state.batchItems.values()].filter((item) => {
          if (item.batchId !== where.batchId) return false;
          if (!where.status) return true;
          if (typeof where.status === 'string') return item.status === where.status;
          return item.status !== where.status.not;
        }).length
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.failAudit) throw new Error('audit-create-failed');
        const record = { id: `audit-${state.audits.length + 1}`, ...data };
        state.audits.push(record);
        return record;
      }
    }
  } as unknown as Prisma.TransactionClient;
}

function makeDatabase(state: TestState, options: WriterOptions = {}) {
  let transactionCalls = 0;
  let queue: Promise<void> = Promise.resolve();
  const database = {
    $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
      transactionCalls += 1;
      const run = async () => {
        const draft = cloneState(state);
        const result = await callback(makeWriter(draft, options));
        commitState(state, draft);
        return result;
      };
      const result = queue.then(run, run);
      queue = result.then(() => undefined, () => undefined);
      return result;
    }
  };
  return { database, transactionCalls: () => transactionCalls };
}

async function expectBatchError(promise: Promise<unknown>, code: RequestSelectionBatchError['code']) {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof RequestSelectionBatchError && error.code === code
  );
}

function firstBatch(state: TestState) {
  return [...state.batches.values()][0]!;
}

function itemsForBatch(state: TestState, batchId: string) {
  return [...state.batchItems.values()]
    .filter((item) => item.batchId === batchId)
    .sort((left, right) => left.position - right.position);
}

async function main() {
  const creationState = initialState();
  const creationDb = makeDatabase(creationState);
  const createBatch = createRequestSelectionBatchService(creationDb.database);
  const created = await createBatch({
    requestId: 'request-1',
    requestItemIds: ['item-2', 'item-1'],
    actor: { id: 'manager' },
    source: 'ADMIN_CRM'
  });

  assert.equal(created.revision, 1);
  assert.equal(created.status, 'DRAFT');
  assert.equal(created.itemCount, 2);
  assert.equal(creationState.requests.get('request-1')?.selectionRevisionCounter, 1);
  assert.equal(creationState.audits.length, 1);
  assert.equal(creationState.audits[0]?.action, 'REQUEST_SELECTION_BATCH_CREATED');
  assert.equal(creationState.audits[0]?.actorRole, 'MANAGER');
  assert.equal(creationState.audits[0]?.actorEmail, 'manager@example.com');
  assert.equal(
    JSON.stringify(creationState.audits[0]).includes(created.snapshotHash),
    false
  );
  const createdItems = itemsForBatch(creationState, created.batchId);
  assert.deepEqual(createdItems.map((item) => item.sourceRequestItemId), ['item-2', 'item-1']);
  assert.deepEqual(createdItems.map((item) => item.position), [1, 2]);
  assert.equal(createdItems[0]?.itemName, 'Масляний фільтр');
  assert.equal(createdItems[1]?.itemName, 'Паливний фільтр');
  assert.equal(createdItems[0]?.status, 'PENDING');
  assert.match(String(createdItems[0]?.snapshotHash), /^[0-9a-f]{64}$/);
  assert.equal(creationState.audits.some((audit) => audit.entityType === 'REQUEST_SELECTION_BATCH_ITEM'), false);

  const second = await createBatch({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'admin' }
  });
  assert.equal(second.revision, 2);
  assert.equal(creationState.requests.get('request-1')?.selectionRevisionCounter, 2);

  const concurrentState = initialState();
  const concurrentDb = makeDatabase(concurrentState);
  const concurrentCreate = createRequestSelectionBatchService(concurrentDb.database);
  const concurrentResults = await Promise.all([
    concurrentCreate({
      requestId: 'request-1',
      requestItemIds: ['item-1'],
      actor: { id: 'manager' }
    }),
    concurrentCreate({
      requestId: 'request-1',
      requestItemIds: ['item-2'],
      actor: { id: 'admin' }
    })
  ]);
  assert.deepEqual(concurrentResults.map((result) => result.revision).sort(), [1, 2]);

  for (const actorId of ['admin', 'manager']) {
    const roleState = initialState();
    const roleService = createRequestSelectionBatchService(makeDatabase(roleState).database);
    const result = await roleService({
      requestId: 'request-1',
      requestItemIds: ['item-1'],
      actor: { id: actorId }
    });
    assert.equal(result.status, 'DRAFT');
  }

  for (const [input, code] of [
    [{ requestId: 'request-1', requestItemIds: [], actor: { id: 'manager' } }, 'EMPTY_SELECTION'],
    [{ requestId: 'request-1', requestItemIds: ['item-1', 'item-1'], actor: { id: 'manager' } }, 'DUPLICATE_REQUEST_ITEM_IDS'],
    [{ requestId: 'missing', requestItemIds: ['item-1'], actor: { id: 'manager' } }, 'REQUEST_NOT_FOUND'],
    [{ requestId: 'request-1', requestItemIds: ['missing'], actor: { id: 'manager' } }, 'REQUEST_ITEM_NOT_FOUND'],
    [{ requestId: 'request-1', requestItemIds: ['foreign-item'], actor: { id: 'manager' } }, 'REQUEST_ITEM_NOT_IN_REQUEST'],
    [{ requestId: 'request-1', requestItemIds: ['item-1'], actor: { id: 'client' } }, 'ACTOR_NOT_ALLOWED'],
    [{ requestId: 'request-1', requestItemIds: ['item-1'], actor: { id: 'disabled-manager' } }, 'ACTOR_NOT_ALLOWED'],
    [{ requestId: 'request-1', requestItemIds: ['item-1'], actor: { id: 'missing-actor' } }, 'ACTOR_NOT_FOUND']
  ] as const) {
    const errorState = initialState();
    const errorService = createRequestSelectionBatchService(makeDatabase(errorState).database);
    await expectBatchError(errorService({
      requestId: input.requestId,
      requestItemIds: [...input.requestItemIds],
      actor: { id: input.actor.id }
    }), code);
    assert.equal(errorState.requests.get('request-1')?.selectionRevisionCounter, 0);
  }

  for (const requestStatus of ['COMPLETED', 'CANCELLED'] as const) {
    const terminalState = initialState(requestStatus);
    const terminalService = createRequestSelectionBatchService(makeDatabase(terminalState).database);
    await expectBatchError(
      terminalService({
        requestId: 'request-1',
        requestItemIds: ['item-1'],
        actor: { id: 'manager' }
      }),
      'REQUEST_TERMINAL'
    );
    assert.equal(terminalState.requests.get('request-1')?.selectionRevisionCounter, 0);
  }

  const versionState = initialState();
  const versionService = createRequestSelectionBatchService(makeDatabase(versionState).database);
  await expectBatchError(
    versionService({
      requestId: 'request-1',
      requestItemIds: ['item-1'],
      actor: { id: 'manager' },
      expectedRequestItemVersions: [{
        id: 'item-1',
        updatedAt: new Date('2026-07-27T09:59:59.000Z')
      }]
    }),
    'SOURCE_ITEM_CHANGED'
  );
  assert.equal(versionState.requests.get('request-1')?.selectionRevisionCounter, 0);

  for (const options of [
    { failBatchCreate: true },
    { failBatchItemPosition: 2 },
    { failAudit: true }
  ]) {
    const rollbackState = initialState();
    const rollbackService = createRequestSelectionBatchService(
      makeDatabase(rollbackState, options).database
    );
    await assert.rejects(rollbackService({
      requestId: 'request-1',
      requestItemIds: ['item-1', 'item-2'],
      actor: { id: 'manager' }
    }));
    assert.equal(rollbackState.requests.get('request-1')?.selectionRevisionCounter, 0);
    assert.equal(rollbackState.batches.size, 0);
    assert.equal(rollbackState.batchItems.size, 0);
    assert.equal(rollbackState.audits.length, 0);
  }

  const existingTxState = initialState();
  const existingTxDb = makeDatabase(existingTxState);
  const existingTxService = createRequestSelectionBatchService(existingTxDb.database);
  const existingTxResult = await existingTxService({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' },
    tx: makeWriter(existingTxState)
  });
  assert.equal(existingTxResult.revision, 1);
  assert.equal(existingTxDb.transactionCalls(), 0);

  const lifecycleState = initialState();
  const lifecycleDb = makeDatabase(lifecycleState);
  const lifecycleCreate = createRequestSelectionBatchService(lifecycleDb.database);
  const lifecycleTransition = createRequestSelectionBatchTransitionService(lifecycleDb.database);
  const lifecycleDraft = await lifecycleCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  const sent = await lifecycleTransition({
    batchId: lifecycleDraft.batchId,
    event: REQUEST_SELECTION_BATCH_EVENTS.SEND,
    actor: { id: 'manager' }
  });
  assert.equal(sent.outcome, 'changed');
  assert.equal(firstBatch(lifecycleState).status, 'SENT');
  assert.ok(firstBatch(lifecycleState).sentAt instanceof Date);
  const repeatSend = await lifecycleTransition({
    batchId: lifecycleDraft.batchId,
    event: REQUEST_SELECTION_BATCH_EVENTS.SEND,
    actor: { id: 'manager' }
  });
  assert.equal(repeatSend.outcome, 'noop');
  assert.equal(lifecycleState.audits.filter((audit) => audit.action === 'REQUEST_SELECTION_BATCH_SENT').length, 1);

  const lifecycleItem = itemsForBatch(lifecycleState, lifecycleDraft.batchId)[0]!;
  lifecycleItem.status = 'APPROVED';
  const approved = await lifecycleTransition({
    batchId: lifecycleDraft.batchId,
    event: REQUEST_SELECTION_BATCH_EVENTS.APPROVE,
    actor: { id: 'client' }
  });
  assert.equal(approved.outcome, 'changed');
  assert.equal(firstBatch(lifecycleState).status, 'APPROVED');
  assert.ok(firstBatch(lifecycleState).approvedAt instanceof Date);
  const approvedLocked = await lifecycleTransition({
    batchId: lifecycleDraft.batchId,
    event: REQUEST_SELECTION_BATCH_EVENTS.REJECT,
    actor: { id: 'client' }
  });
  assert.deepEqual(approvedLocked, {
    outcome: 'blocked',
    currentStatus: 'APPROVED',
    reason: 'final_status_locked'
  });

  const partialState = initialState();
  const partialDb = makeDatabase(partialState);
  const partialCreate = createRequestSelectionBatchService(partialDb.database);
  const partialTransition = createRequestSelectionBatchTransitionService(partialDb.database);
  const partialDraft = await partialCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  await partialTransition({
    batchId: partialDraft.batchId,
    event: 'SEND',
    actor: { id: 'admin' }
  });
  assert.deepEqual(await partialTransition({
    batchId: partialDraft.batchId,
    event: 'APPROVE',
    actor: { id: 'client' }
  }), {
    outcome: 'blocked',
    currentStatus: 'SENT',
    reason: 'items_not_fully_approved'
  });
  assert.deepEqual(await partialTransition({
    batchId: partialDraft.batchId,
    event: 'REJECT',
    actor: { id: 'client' }
  }), {
    outcome: 'blocked',
    currentStatus: 'SENT',
    reason: 'no_rejected_items'
  });
  itemsForBatch(partialState, partialDraft.batchId)[0]!.status = 'REJECTED';
  const rejected = await partialTransition({
    batchId: partialDraft.batchId,
    event: 'REJECT',
    actor: { id: 'client' }
  });
  assert.equal(rejected.outcome, 'changed');
  assert.equal(firstBatch(partialState).status, 'REJECTED');
  assert.ok(firstBatch(partialState).rejectedAt instanceof Date);

  const supersedeState = initialState();
  const supersedeDb = makeDatabase(supersedeState);
  const supersedeCreate = createRequestSelectionBatchService(supersedeDb.database);
  const supersedeTransition = createRequestSelectionBatchTransitionService(supersedeDb.database);
  const supersedeDraft = await supersedeCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  const superseded = await supersedeTransition({
    batchId: supersedeDraft.batchId,
    event: 'SUPERSEDE',
    actor: { id: 'admin' }
  });
  assert.equal(superseded.outcome, 'changed');
  assert.equal(firstBatch(supersedeState).status, 'SUPERSEDED');
  assert.ok(firstBatch(supersedeState).supersededAt instanceof Date);

  const roleGuardState = initialState();
  const roleGuardDb = makeDatabase(roleGuardState);
  const roleCreate = createRequestSelectionBatchService(roleGuardDb.database);
  const roleTransition = createRequestSelectionBatchTransitionService(roleGuardDb.database);
  const roleDraft = await roleCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  await expectBatchError(roleTransition({
    batchId: roleDraft.batchId,
    event: 'SEND',
    actor: { id: 'client' }
  }), 'ACTOR_NOT_ALLOWED');
  await roleTransition({
    batchId: roleDraft.batchId,
    event: 'SEND',
    actor: { id: 'manager' }
  });
  itemsForBatch(roleGuardState, roleDraft.batchId)[0]!.status = 'APPROVED';
  await expectBatchError(roleTransition({
    batchId: roleDraft.batchId,
    event: 'APPROVE',
    actor: { id: 'manager' }
  }), 'ACTOR_NOT_ALLOWED');

  const conflictState = initialState();
  const conflictDb = makeDatabase(conflictState);
  const conflictCreate = createRequestSelectionBatchService(conflictDb.database);
  const conflictTransition = createRequestSelectionBatchTransitionService(conflictDb.database);
  const [conflictOne, conflictTwo] = [
    await conflictCreate({
      requestId: 'request-1',
      requestItemIds: ['item-1'],
      actor: { id: 'manager' }
    }),
    await conflictCreate({
      requestId: 'request-1',
      requestItemIds: ['item-2'],
      actor: { id: 'admin' }
    })
  ];
  await conflictTransition({
    batchId: conflictOne.batchId,
    event: 'SEND',
    actor: { id: 'manager' }
  });
  await expectBatchError(conflictTransition({
    batchId: conflictTwo.batchId,
    event: 'SEND',
    actor: { id: 'admin' }
  }), 'ACTIVE_SENT_BATCH_CONFLICT');
  assert.equal(
    [...conflictState.batches.values()].filter((batch) => batch.status === 'SENT').length,
    1
  );
  assert.equal(
    conflictState.audits.filter((audit) => audit.action === 'REQUEST_SELECTION_BATCH_SENT').length,
    1
  );

  const concurrentWinnerState = initialState();
  const concurrentWinnerDb = makeDatabase(concurrentWinnerState, {
    concurrentBatchStatus: 'SENT'
  });
  const concurrentWinnerCreate = createRequestSelectionBatchService(concurrentWinnerDb.database);
  const concurrentWinnerTransition = createRequestSelectionBatchTransitionService(
    concurrentWinnerDb.database
  );
  const concurrentWinnerDraft = await concurrentWinnerCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  const concurrentNoop = await concurrentWinnerTransition({
    batchId: concurrentWinnerDraft.batchId,
    event: 'SEND',
    actor: { id: 'admin' }
  });
  assert.equal(concurrentNoop.outcome, 'noop');
  assert.equal(
    concurrentWinnerState.audits.filter(
      (audit) => audit.action === 'REQUEST_SELECTION_BATCH_SENT'
    ).length,
    0
  );

  const lifecycleRollbackState = initialState();
  const lifecycleRollbackCreateDb = makeDatabase(lifecycleRollbackState);
  const lifecycleRollbackCreate = createRequestSelectionBatchService(
    lifecycleRollbackCreateDb.database
  );
  const lifecycleRollbackDraft = await lifecycleRollbackCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  const lifecycleRollbackTransition = createRequestSelectionBatchTransitionService(
    makeDatabase(lifecycleRollbackState, { failAudit: true }).database
  );
  await assert.rejects(lifecycleRollbackTransition({
    batchId: lifecycleRollbackDraft.batchId,
    event: 'SEND',
    actor: { id: 'admin' }
  }));
  assert.equal(firstBatch(lifecycleRollbackState).status, 'DRAFT');
  assert.equal(firstBatch(lifecycleRollbackState).sentAt, null);

  const lifecycleTxState = initialState();
  const lifecycleTxDb = makeDatabase(lifecycleTxState);
  const lifecycleTxCreate = createRequestSelectionBatchService(lifecycleTxDb.database);
  const lifecycleTxDraft = await lifecycleTxCreate({
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    actor: { id: 'manager' }
  });
  const lifecycleTxTransition = createRequestSelectionBatchTransitionService(lifecycleTxDb.database);
  const callsBeforeExistingTransition = lifecycleTxDb.transactionCalls();
  await lifecycleTxTransition({
    batchId: lifecycleTxDraft.batchId,
    event: 'SEND',
    actor: { id: 'admin' },
    tx: makeWriter(lifecycleTxState)
  });
  assert.equal(lifecycleTxDb.transactionCalls(), callsBeforeExistingTransition);

  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /CREATE TYPE "RequestSelectionBatchStatus"/);
  assert.match(migration, /CREATE TYPE "RequestSelectionBatchItemStatus"/);
  assert.match(migration, /ADD COLUMN "selectionRevisionCounter" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /UNIQUE INDEX "RequestSelectionBatch_requestId_revision_key"/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "RequestSelectionBatch_one_sent_per_request"[\s\S]*WHERE "status" = 'SENT'/
  );
  assert.match(migration, /ON DELETE SET NULL ON UPDATE CASCADE/);
  assert.doesNotMatch(migration, /\bUPDATE "RequestSelectionBatch"/);
  assert.doesNotMatch(migration, /\bTRUNCATE\b|\bDROP TABLE\b|\bDELETE FROM\b/);

  const serviceSource = readFileSync(resolve(cwd, 'lib/request-selection/service.ts'), 'utf8');
  assert.match(serviceSource, /selectionRevisionCounter:\s*\{\s*increment:\s*1\s*\}/);
  assert.doesNotMatch(serviceSource, /\.count\(\)[\s\S]{0,100}revision|MAX\s*\(/i);

  const adminActionsSource = readFileSync(resolve(cwd, 'app/admin/actions.ts'), 'utf8');
  assert.match(
    adminActionsSource,
    /from '@\/lib\/request-selection\/send-for-approval'/
  );
  assert.doesNotMatch(
    adminActionsSource,
    /requestSelectionBatch\.(create|update|updateMany)/
  );

  for (const productionFile of [
    'lib/telegram/notifications.ts',
    'lib/commercial-offers/service.ts',
    'lib/invoices/service.ts'
  ]) {
    const productionSource = readFileSync(resolve(cwd, productionFile), 'utf8');
    assert.doesNotMatch(productionSource, /request-selection|RequestSelectionBatch/);
  }
  const clientActionsSource = readFileSync(resolve(cwd, 'app/client/actions.ts'), 'utf8');
  assert.doesNotMatch(
    clientActionsSource,
    /requestSelectionBatch(Item)?\.(create|update|updateMany|delete|deleteMany)/
  );

  console.log('Request selection batch foundation verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
