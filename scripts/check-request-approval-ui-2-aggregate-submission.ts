import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createSubmitClientSelectionService,
  SubmitClientSelectionError
} from '../lib/request-selection/client-submission';
import {
  REQUEST_STATUS_EVENTS,
  resolveRequestStatusTransition
} from '../lib/requests/status-transition';

type UserRow = {
  id: string;
  role: 'CLIENT' | 'ADMIN' | 'MANAGER';
  status: 'ACTIVE' | 'DISABLED';
  clientProfile: { id: string } | null;
  companyMemberships: Array<{ companyId: string }>;
};

type RequestRow = {
  id: string;
  requestNumber: string;
  status:
    | 'WAITING_APPROVAL'
    | 'AWAITING_INVOICE'
    | 'CANCELLED';
  clientId: string | null;
  companyId: string | null;
};

type BatchRow = {
  id: string;
  requestId: string;
  revision: number;
  status:
    | 'DRAFT'
    | 'SENT'
    | 'APPROVED'
    | 'PARTIALLY_APPROVED'
    | 'REJECTED'
    | 'SUPERSEDED';
};

type ItemRow = {
  id: string;
  batchId: string;
  position: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionByUserId: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  clientComment: string | null;
};

type State = {
  users: Map<string, UserRow>;
  requests: Map<string, RequestRow>;
  batches: Map<string, BatchRow>;
  items: Map<string, ItemRow>;
  audits: Array<{ action: string; metadata?: Record<string, unknown> }>;
  histories: Array<{ oldStatus: string; newStatus: string }>;
};

type FailureMode = 'item-update' | 'batch-transition' | 'request-transition' | 'audit';

type TestTx = {
  __state: State;
  __failure: FailureMode | null;
  __itemUpdateCalls: number;
  user: { findUnique(input: { where: { id: string } }): Promise<UserRow | null> };
  request: {
    findUnique(input: { where: { id: string } }): Promise<RequestRow | null>;
  };
  requestSelectionBatch: {
    findUnique(input: { where: { id: string } }): Promise<(BatchRow & { items: ItemRow[] }) | null>;
    findMany(input: {
      where: { requestId: string; status: string };
      take?: number;
    }): Promise<Array<Pick<BatchRow, 'id' | 'revision'>>>;
  };
  requestSelectionBatchItem: {
    updateMany(input: {
      where: { batchId: string; id: { in: string[] }; status: string };
      data: Partial<ItemRow>;
    }): Promise<{ count: number }>;
  };
};

function cloneState(state: State): State {
  return structuredClone(state);
}

function initialState(itemCount = 3): State {
  const items = new Map<string, ItemRow>();
  for (let index = 1; index <= itemCount; index += 1) {
    items.set(`item-${index}`, {
      id: `item-${index}`,
      batchId: 'batch-1',
      position: index,
      status: 'PENDING',
      decisionByUserId: null,
      approvedAt: null,
      rejectedAt: null,
      clientComment: null
    });
  }
  return {
    users: new Map([
      ['client-1', {
        id: 'client-1',
        role: 'CLIENT',
        status: 'ACTIVE',
        clientProfile: { id: 'profile-1' },
        companyMemberships: []
      }]
    ]),
    requests: new Map([
      ['request-1', {
        id: 'request-1',
        requestNumber: 'KP-1',
        status: 'WAITING_APPROVAL',
        clientId: 'profile-1',
        companyId: null
      }]
    ]),
    batches: new Map([
      ['batch-1', {
        id: 'batch-1',
        requestId: 'request-1',
        revision: 1,
        status: 'SENT'
      }]
    ]),
    items,
    audits: [],
    histories: []
  };
}

function createTx(state: State, failure: FailureMode | null): TestTx {
  const tx: TestTx = {
    __state: state,
    __failure: failure,
    __itemUpdateCalls: 0,
    user: {
      async findUnique({ where }) {
        return state.users.get(where.id) ?? null;
      }
    },
    request: {
      async findUnique({ where }) {
        return state.requests.get(where.id) ?? null;
      }
    },
    requestSelectionBatch: {
      async findUnique({ where }) {
        const batch = state.batches.get(where.id);
        if (!batch) return null;
        return {
          ...batch,
          items: [...state.items.values()]
            .filter((item) => item.batchId === batch.id)
            .sort((left, right) => left.position - right.position)
        };
      },
      async findMany({ where, take }) {
        return [...state.batches.values()]
          .filter(
            (batch) =>
              batch.requestId === where.requestId
              && batch.status === where.status
          )
          .sort((left, right) => right.revision - left.revision)
          .slice(0, take)
          .map(({ id, revision }) => ({ id, revision }));
      }
    },
    requestSelectionBatchItem: {
      async updateMany({ where, data }) {
        tx.__itemUpdateCalls += 1;
        if (failure === 'item-update' && tx.__itemUpdateCalls === 2) {
          return { count: 0 };
        }
        let count = 0;
        for (const id of where.id.in) {
          const current = state.items.get(id);
          if (
            current
            && current.batchId === where.batchId
            && current.status === where.status
          ) {
            state.items.set(id, { ...current, ...data });
            count += 1;
          }
        }
        return { count };
      }
    }
  };
  return tx;
}

class FakeDatabase {
  state: State;
  failure: FailureMode | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(state = initialState()) {
    this.state = state;
  }

  async $transaction<T>(
    callback: (tx: TestTx) => Promise<T>,
    options?: { isolationLevel?: string }
  ) {
    assert.equal(options?.isolationLevel, 'Serializable');
    const previous = this.queue;
    let release = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const working = cloneState(this.state);
    try {
      const result = await callback(createTx(working, this.failure));
      this.state = working;
      return result;
    } finally {
      release();
    }
  }
}

function stateFromTx(tx: unknown) {
  return (tx as TestTx).__state;
}

function dependencies() {
  return {
    async transitionBatch(input: {
      tx?: unknown;
      batchId: string;
      event: 'APPROVE' | 'PARTIALLY_APPROVE' | 'REJECT';
      aggregate?: {
        totalCount: number;
        approvedCount: number;
        rejectedCount: number;
      };
    }) {
      const tx = input.tx as TestTx;
      if (tx.__failure === 'batch-transition') {
        throw new Error('batch transition failed');
      }
      const state = stateFromTx(tx);
      const batch = state.batches.get(input.batchId);
      assert.ok(batch);
      if (batch.status !== 'SENT') {
        return { outcome: 'blocked' as const, currentStatus: batch.status, reason: 'final_status_locked' as const };
      }
      const target = input.event === 'APPROVE'
        ? 'APPROVED' as const
        : input.event === 'PARTIALLY_APPROVE'
          ? 'PARTIALLY_APPROVED' as const
          : 'REJECTED' as const;
      batch.status = target;
      state.audits.push({
        action: `REQUEST_SELECTION_BATCH_${target}`,
        metadata: input.aggregate
      });
      return {
        outcome: 'changed' as const,
        previousStatus: 'SENT' as const,
        nextStatus: target,
        auditLogId: `batch-audit-${state.audits.length}`
      };
    },
    async transitionRequest(input: {
      tx?: unknown;
      requestId: string;
      event:
        | typeof REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED
        | typeof REQUEST_STATUS_EVENTS.CLIENT_SELECTION_REJECTED_ALL;
    }) {
      const tx = input.tx as TestTx;
      if (tx.__failure === 'request-transition') {
        throw new Error('request transition failed');
      }
      const state = stateFromTx(tx);
      const request = state.requests.get(input.requestId);
      assert.ok(request);
      const decision = resolveRequestStatusTransition(request.status, input.event);
      if (decision.outcome !== 'allowed') return decision;
      const previousStatus = request.status;
      request.status = decision.nextStatus as RequestRow['status'];
      state.histories.push({
        oldStatus: previousStatus,
        newStatus: request.status
      });
      state.audits.push({
        action: 'REQUEST_STATUS_CHANGED',
        metadata: { event: input.event }
      });
      return {
        outcome: 'changed' as const,
        previousStatus,
        nextStatus: request.status,
        historyId: `history-${state.histories.length}`,
        auditLogId: `request-audit-${state.audits.length}`
      };
    },
    async writeAudit(txValue: unknown, input: {
      action: string;
      metadata?: Record<string, unknown>;
    }) {
      const tx = txValue as TestTx;
      if (tx.__failure === 'audit') throw new Error('audit failed');
      const state = stateFromTx(tx);
      state.audits.push({
        action: input.action,
        metadata: input.metadata
      });
      return { id: `aggregate-audit-${state.audits.length}` };
    }
  };
}

function service(database: FakeDatabase) {
  return createSubmitClientSelectionService(
    database as never,
    dependencies() as never
  );
}

function input(approvedBatchItemIds: string[], actorId = 'client-1') {
  return {
    requestId: 'request-1',
    batchId: 'batch-1',
    expectedRevision: 1,
    approvedBatchItemIds,
    actor: { id: actorId },
    source: 'CLIENT_CABINET' as const
  };
}

function assertStatuses(
  state: State,
  expected: Record<string, ItemRow['status']>
) {
  for (const [id, status] of Object.entries(expected)) {
    assert.equal(state.items.get(id)?.status, status);
  }
}

async function expectCode(
  run: () => Promise<unknown>,
  code: SubmitClientSelectionError['code']
) {
  await assert.rejects(
    run,
    (error) => error instanceof SubmitClientSelectionError && error.code === code
  );
}

async function main() {
  assert.deepEqual(
    resolveRequestStatusTransition(
      'WAITING_APPROVAL',
      REQUEST_STATUS_EVENTS.CLIENT_SELECTION_REJECTED_ALL
    ),
    { outcome: 'allowed', nextStatus: 'CANCELLED' }
  );

  const allDb = new FakeDatabase();
  const allResult = await service(allDb)(input(['item-1', 'item-2', 'item-3']));
  assert.equal(allResult.outcome, 'changed');
  assert.equal(allResult.batchStatus, 'APPROVED');
  assert.equal(allResult.requestStatus, 'AWAITING_INVOICE');
  assertStatuses(allDb.state, {
    'item-1': 'APPROVED',
    'item-2': 'APPROVED',
    'item-3': 'APPROVED'
  });
  assert.equal(allDb.state.batches.get('batch-1')?.status, 'APPROVED');
  assert.equal(allDb.state.requests.get('request-1')?.status, 'AWAITING_INVOICE');
  assert.equal(allDb.state.histories.length, 1);

  const partialDb = new FakeDatabase();
  const partialResult = await service(partialDb)(input(['item-2']));
  assert.equal(partialResult.outcome, 'changed');
  assert.equal(partialResult.batchStatus, 'PARTIALLY_APPROVED');
  assert.equal(partialResult.requestStatus, 'AWAITING_INVOICE');
  assertStatuses(partialDb.state, {
    'item-1': 'REJECTED',
    'item-2': 'APPROVED',
    'item-3': 'REJECTED'
  });
  assert.equal(partialDb.state.batches.get('batch-1')?.status, 'PARTIALLY_APPROVED');
  assert.equal(partialDb.state.requests.get('request-1')?.status, 'AWAITING_INVOICE');

  const zeroDb = new FakeDatabase();
  const zeroResult = await service(zeroDb)(input([]));
  assert.equal(zeroResult.outcome, 'changed');
  assert.equal(zeroResult.batchStatus, 'REJECTED');
  assert.equal(zeroResult.requestStatus, 'CANCELLED');
  assertStatuses(zeroDb.state, {
    'item-1': 'REJECTED',
    'item-2': 'REJECTED',
    'item-3': 'REJECTED'
  });
  assert.equal(zeroDb.state.batches.get('batch-1')?.status, 'REJECTED');
  assert.equal(zeroDb.state.requests.get('request-1')?.status, 'CANCELLED');
  assert.equal(zeroDb.state.histories.at(-1)?.newStatus, 'CANCELLED');
  assert.ok(
    zeroDb.state.audits.some(
      (audit) =>
        audit.action === 'REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED'
        && audit.metadata?.event === 'CLIENT_SELECTION_SUBMITTED'
        && audit.metadata?.rejectedItems === 3
    )
  );
  assert.ok([...zeroDb.state.items.values()].every((item) => item.clientComment === null));

  const duplicateDb = new FakeDatabase();
  await expectCode(
    () => service(duplicateDb)(input(['item-1', 'item-1'])),
    'DUPLICATE_BATCH_ITEM_ID'
  );
  assert.equal(duplicateDb.state.audits.length, 0);

  const unknownDb = new FakeDatabase();
  await expectCode(
    () => service(unknownDb)(input(['other-batch-item'])),
    'UNKNOWN_BATCH_ITEM_ID'
  );
  assertStatuses(unknownDb.state, {
    'item-1': 'PENDING',
    'item-2': 'PENDING',
    'item-3': 'PENDING'
  });

  const foreignDb = new FakeDatabase();
  foreignDb.state.users.set('foreign-client', {
    id: 'foreign-client',
    role: 'CLIENT',
    status: 'ACTIVE',
    clientProfile: { id: 'profile-2' },
    companyMemberships: []
  });
  await expectCode(
    () => service(foreignDb)(input(['item-1'], 'foreign-client')),
    'REQUEST_ACCESS_DENIED'
  );

  const inactiveDb = new FakeDatabase();
  inactiveDb.state.users.get('client-1')!.status = 'DISABLED';
  await expectCode(
    () => service(inactiveDb)(input(['item-1'])),
    'ACTOR_NOT_ALLOWED'
  );

  const adminDb = new FakeDatabase();
  adminDb.state.users.get('client-1')!.role = 'ADMIN';
  await expectCode(
    () => service(adminDb)(input(['item-1'])),
    'ACTOR_NOT_ALLOWED'
  );

  const staleDb = new FakeDatabase();
  staleDb.state.batches.get('batch-1')!.status = 'SUPERSEDED';
  await expectCode(
    () => service(staleDb)(input(['item-1'])),
    'STALE_SELECTION_REVISION'
  );
  assertStatuses(staleDb.state, {
    'item-1': 'PENDING',
    'item-2': 'PENDING',
    'item-3': 'PENDING'
  });

  const revisionDb = new FakeDatabase();
  await expectCode(
    () => service(revisionDb)({ ...input(['item-1']), expectedRevision: 2 }),
    'STALE_SELECTION_REVISION'
  );

  const retryDb = new FakeDatabase();
  const retryService = service(retryDb);
  const first = await retryService(input(['item-1', 'item-3']));
  assert.equal(first.outcome, 'changed');
  const auditCount = retryDb.state.audits.length;
  const historyCount = retryDb.state.histories.length;
  const identical = await retryService(input(['item-3', 'item-1']));
  assert.equal(identical.outcome, 'noop');
  assert.equal(retryDb.state.audits.length, auditCount);
  assert.equal(retryDb.state.histories.length, historyCount);
  await expectCode(
    () => retryService(input(['item-2'])),
    'SUBMISSION_CONFLICT'
  );
  assert.equal(retryDb.state.audits.length, auditCount);

  for (const failure of [
    'item-update',
    'batch-transition',
    'request-transition',
    'audit'
  ] as const) {
    const failureDb = new FakeDatabase();
    failureDb.failure = failure;
    const before = cloneState(failureDb.state);
    await assert.rejects(() => service(failureDb)(input(['item-1'])));
    assert.deepEqual(failureDb.state, before);
  }

  const doubleDb = new FakeDatabase();
  const doubleService = service(doubleDb);
  const identicalResults = await Promise.all([
    doubleService(input(['item-1', 'item-2'])),
    doubleService(input(['item-2', 'item-1']))
  ]);
  assert.deepEqual(
    identicalResults.map((result) => result.outcome).sort(),
    ['changed', 'noop']
  );
  assert.ok([...doubleDb.state.items.values()].every((item) => item.status !== 'PENDING'));

  const conflictDb = new FakeDatabase();
  const conflictService = service(conflictDb);
  const conflictingResults = await Promise.allSettled([
    conflictService(input(['item-1'])),
    conflictService(input(['item-2']))
  ]);
  assert.equal(
    conflictingResults.filter((result) => result.status === 'fulfilled').length,
    1
  );
  const rejected = conflictingResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  assert.ok(rejected?.reason instanceof SubmitClientSelectionError);
  assert.equal(rejected?.reason.code, 'SUBMISSION_CONFLICT');
  assert.ok([...conflictDb.state.items.values()].every((item) => item.status !== 'PENDING'));

  const supersedeDb = new FakeDatabase();
  const supersedePromise = supersedeDb.$transaction(async (tx) => {
    tx.__state.batches.get('batch-1')!.status = 'SUPERSEDED';
    return 'superseded';
  }, { isolationLevel: 'Serializable' });
  const submitAfterSupersede = service(supersedeDb)(input(['item-1']));
  assert.equal(await supersedePromise, 'superseded');
  await expectCode(() => submitAfterSupersede, 'STALE_SELECTION_REVISION');
  assertStatuses(supersedeDb.state, {
    'item-1': 'PENDING',
    'item-2': 'PENDING',
    'item-3': 'PENDING'
  });

  const component = readFileSync(
    'components/client/client-selection-checkbox-list.tsx',
    'utf8'
  );
  const action = readFileSync('app/client/actions.ts', 'utf8');
  const serviceSource = readFileSync(
    'lib/request-selection/client-submission.ts',
    'utf8'
  );
  assert.match(component, /Надіслати погодження/);
  assert.match(component, /Підтвердити та надіслати/);
  assert.match(component, /Підтвердити відмову/);
  assert.match(component, /Ви не погодили жодної позиції/);
  assert.match(component, /Позиції без галочки будуть позначені як непогоджені/);
  assert.match(component, /disabled=\{pending\}/);
  assert.match(component, /if \(pending\) return/);
  assert.match(component, /router\.refresh\(\)/);
  assert.match(component, /setConfirmationOpen\(false\)/);
  assert.match(component, /submitAction\(formData\)/);
  assert.doesNotMatch(component, /decideClientSelectionItemAction/);
  assert.doesNotMatch(component, /ClientSelectionDecisionControls/);
  assert.match(action, /approvedBatchItemIds/);
  assert.match(action, /submitClientSelection\(/);
  assert.match(
    readFileSync('components/client/client-approval-batch-section.tsx', 'utf8'),
    /submitAction=\{submitClientSelectionAction\}/
  );
  assert.match(serviceSource, /isolationLevel: 'Serializable'/);
  assert.match(serviceSource, /CLIENT_SELECTION_SUBMITTED/);
  assert.match(serviceSource, /clientComment: null/);

  console.log('Stage Request Approval UI 2 aggregate submission checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
