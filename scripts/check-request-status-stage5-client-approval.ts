import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Prisma } from '@prisma/client';

import {
  CLIENT_SELECTION_DECISIONS,
  ClientSelectionDecisionError,
  createClientSelectionDecisionService,
  parseClientSelectionComment
} from '../lib/request-selection/client-decision';
import { resolveRequestSelectionBatchTransition } from '../lib/request-selection/lifecycle';
import {
  REQUEST_STATUS_EVENTS,
  resolveRequestStatusTransition
} from '../lib/requests/status-transition';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const schema = read('prisma/schema.prisma');
const migration = read(
  'prisma/migrations/20260728120000_add_request_selection_item_audit_events/migration.sql'
);
const service = read('lib/request-selection/client-decision.ts');
const actions = read('app/client/actions.ts');
const clientUi = read('components/client/client-approval-batch-section.tsx');
const controls = read('components/client/client-selection-decision-controls.tsx');
const adminUi = read('app/admin/requests/[id]/page.tsx');
const readModel = read('lib/request-selection/client-read-model.ts');

function expectCode(run: () => unknown, code: ClientSelectionDecisionError['code']) {
  assert.throws(
    run,
    (error) => error instanceof ClientSelectionDecisionError && error.code === code
  );
}

assert.equal(parseClientSelectionComment('APPROVE', undefined), null);
assert.equal(parseClientSelectionComment('APPROVE', '  Гаразд  '), 'Гаразд');
assert.equal(
  parseClientSelectionComment('REJECT', '  Не підходить  '),
  'Не підходить'
);
expectCode(
  () => parseClientSelectionComment(CLIENT_SELECTION_DECISIONS.REJECT, ''),
  'REJECTION_COMMENT_REQUIRED'
);
expectCode(
  () => parseClientSelectionComment(CLIENT_SELECTION_DECISIONS.REJECT, 'ні'),
  'REJECTION_COMMENT_INVALID'
);
expectCode(
  () => parseClientSelectionComment(CLIENT_SELECTION_DECISIONS.REJECT, 'x'.repeat(501)),
  'REJECTION_COMMENT_INVALID'
);
expectCode(
  () => parseClientSelectionComment(CLIENT_SELECTION_DECISIONS.REJECT, '<b>ні</b>'),
  'REJECTION_COMMENT_INVALID'
);
expectCode(
  () => parseClientSelectionComment(CLIENT_SELECTION_DECISIONS.REJECT, '<script>x</script>'),
  'REJECTION_COMMENT_INVALID'
);

assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'APPROVE'), {
  outcome: 'allowed',
  nextStatus: 'APPROVED'
});
assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'REJECT'), {
  outcome: 'allowed',
  nextStatus: 'REJECTED'
});
assert.equal(
  resolveRequestSelectionBatchTransition('REJECTED', 'APPROVE').outcome,
  'blocked'
);
assert.equal(
  resolveRequestSelectionBatchTransition('SUPERSEDED', 'REJECT').outcome,
  'blocked'
);
assert.deepEqual(
  resolveRequestStatusTransition(
    'WAITING_APPROVAL',
    REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED
  ),
  { outcome: 'allowed', nextStatus: 'AWAITING_INVOICE' }
);
assert.equal(
  resolveRequestStatusTransition(
    'AWAITING_INVOICE',
    REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED
  ).outcome,
  'noop'
);
assert.equal(
  resolveRequestStatusTransition(
    'IN_PROGRESS',
    REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED
  ).outcome,
  'blocked'
);

for (const value of [
  'REQUEST_SELECTION_BATCH_ITEM',
  'REQUEST_SELECTION_ITEM_APPROVED',
  'REQUEST_SELECTION_ITEM_REJECTED'
]) {
  assert.match(schema, new RegExp(`\\b${value}\\b`));
  assert.match(migration, new RegExp(`'${value}'`));
}

for (const guard of [
  "actor.role !== 'CLIENT'",
  "actor.status !== 'ACTIVE'",
  'actorCanAccessRequest(actor, request)',
  "batch.status !== 'SENT'",
  "request.status !== 'WAITING_APPROVAL'",
  'batch.revision !== input.expectedRevision',
  "status: 'PENDING'",
  "isolationLevel: 'Serializable'",
  "event: 'APPROVE'",
  "event: 'REJECT'",
  'REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED',
  "entityType: 'REQUEST_SELECTION_BATCH_ITEM'",
  "'REQUEST_SELECTION_ITEM_APPROVED'",
  "'REQUEST_SELECTION_ITEM_REJECTED'",
  "reason: 'Клієнт погодив усі позиції актуальної версії підбору'"
]) {
  assert.ok(service.includes(guard), `Stage 5 service guard is missing: ${guard}`);
}

for (const code of [
  'REQUEST_NOT_FOUND',
  'ACTOR_NOT_FOUND',
  'ACTOR_NOT_ALLOWED',
  'REQUEST_ACCESS_DENIED',
  'BATCH_NOT_FOUND',
  'BATCH_ITEM_NOT_FOUND',
  'BATCH_NOT_ACTIVE',
  'STALE_SELECTION_REVISION',
  'REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION',
  'BATCH_ITEM_ALREADY_DECIDED',
  'BATCH_ITEM_DECISION_CONFLICT',
  'REJECTION_COMMENT_REQUIRED',
  'REJECTION_COMMENT_INVALID',
  'BATCH_TRANSITION_FAILED',
  'REQUEST_STATUS_TRANSITION_FAILED',
  'CONCURRENT_SELECTION_DECISION',
  'DATABASE_TRANSACTION_FAILED'
]) {
  assert.ok(service.includes(`'${code}'`), `Typed code is missing: ${code}`);
}

assert.ok(actions.includes('decideClientSelectionItemAction'));
assert.ok(actions.includes("revalidatePath('/client/requests')"));
assert.ok(actions.includes("revalidatePath('/admin')"));
assert.ok(actions.includes('selection-fully-approved'));
assert.ok(actions.includes('selection-item-rejected'));
assert.ok(!clientUi.includes('approveClientRequestItemsAction'));
assert.ok(clientUi.includes('ClientSelectionDecisionControls'));
assert.ok(clientUi.includes('Ви погодили цю позицію.'));
assert.ok(clientUi.includes('Позицію відхилено.'));
assert.ok(controls.includes('Підтвердити відхилення'));
assert.ok(controls.includes('minLength={3}'));
assert.ok(controls.includes('maxLength={500}'));
assert.ok(readModel.includes("status: { in: ['APPROVED', 'REJECTED'] }"));
assert.ok(readModel.includes('clientComment: true'));
assert.ok(adminUi.includes('Рішення клієнта · версія'));
assert.ok(adminUi.includes('Очікує рішення'));
assert.ok(adminUi.includes('Погоджено'));
assert.ok(adminUi.includes('Відхилено'));
assert.ok(!service.includes('ChangeRequest'));
assert.ok(!service.includes('INVOICE_SENT'));
assert.ok(!service.includes("data: { status: 'AWAITING_INVOICE'"));
assert.ok(!service.includes('approvedByClient'));

type State = {
  users: Map<string, Record<string, unknown>>;
  requests: Map<string, Record<string, unknown>>;
  batches: Map<string, Record<string, unknown>>;
  items: Map<string, Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
  histories: Array<Record<string, unknown>>;
};

function initialState(): State {
  return {
    users: new Map([
      ['client-1', {
        id: 'client-1',
        name: 'Client One',
        email: 'client@example.test',
        role: 'CLIENT',
        status: 'ACTIVE',
        clientProfile: { id: 'profile-1' },
        companyMemberships: [{ companyId: 'company-1' }]
      }],
      ['client-2', {
        id: 'client-2',
        name: 'Client Two',
        email: 'client2@example.test',
        role: 'CLIENT',
        status: 'ACTIVE',
        clientProfile: { id: 'profile-2' },
        companyMemberships: [{ companyId: 'company-2' }]
      }],
      ['admin-1', {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@example.test',
        role: 'ADMIN',
        status: 'ACTIVE',
        clientProfile: null,
        companyMemberships: []
      }]
    ]),
    requests: new Map([['request-1', {
      id: 'request-1',
      requestNumber: 'KP-TEST-5',
      status: 'WAITING_APPROVAL',
      clientId: null,
      companyId: 'company-1'
    }]]),
    batches: new Map([['batch-1', {
      id: 'batch-1',
      requestId: 'request-1',
      revision: 1,
      status: 'SENT',
      request: { requestNumber: 'KP-TEST-5', companyId: 'company-1' }
    }]]),
    items: new Map([
      ['item-1', { id: 'item-1', batchId: 'batch-1', status: 'PENDING' }],
      ['item-2', { id: 'item-2', batchId: 'batch-1', status: 'PENDING' }]
    ]),
    audits: [],
    histories: []
  };
}

function cloneState(state: State): State {
  return structuredClone(state);
}

function commitState(target: State, source: State) {
  target.users = source.users;
  target.requests = source.requests;
  target.batches = source.batches;
  target.items = source.items;
  target.audits = source.audits;
  target.histories = source.histories;
}

function makeTx(state: State): Prisma.TransactionClient {
  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.users.get(where.id) ?? null
    },
    request: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.requests.get(where.id) ?? null,
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; status: string };
        data: { status: string };
      }) => {
        const request = state.requests.get(where.id);
        if (!request || request.status !== where.status) return { count: 0 };
        request.status = data.status;
        return { count: 1 };
      }
    },
    requestSelectionBatch: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.batches.get(where.id) ?? null,
      findMany: async ({
        where,
        take
      }: {
        where: { requestId: string; status: string };
        take: number;
      }) => [...state.batches.values()]
        .filter((batch) =>
          batch.requestId === where.requestId && batch.status === where.status
        )
        .sort((left, right) => Number(right.revision) - Number(left.revision))
        .slice(0, take),
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        const batch = state.batches.get(where.id);
        if (!batch || batch.status !== where.status) return { count: 0 };
        Object.assign(batch, data);
        return { count: 1 };
      }
    },
    requestSelectionBatchItem: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.items.get(where.id) ?? null,
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; batchId: string; status: string };
        data: Record<string, unknown>;
      }) => {
        const item = state.items.get(where.id);
        if (
          !item
          || item.batchId !== where.batchId
          || item.status !== where.status
        ) return { count: 0 };
        Object.assign(item, data);
        return { count: 1 };
      },
      count: async ({
        where
      }: {
        where: {
          batchId: string;
          status?: string | { not: string };
        };
      }) => [...state.items.values()].filter((item) => {
        if (item.batchId !== where.batchId) return false;
        if (typeof where.status === 'string') return item.status === where.status;
        if (where.status?.not) return item.status !== where.status.not;
        return true;
      }).length,
      groupBy: async ({ where }: { where: { batchId: string } }) => {
        const counts = new Map<string, number>();
        for (const item of state.items.values()) {
          if (item.batchId !== where.batchId) continue;
          const status = String(item.status);
          counts.set(status, (counts.get(status) ?? 0) + 1);
        }
        return [...counts].map(([status, count]) => ({
          status,
          _count: { _all: count }
        }));
      }
    },
    requestStatusHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const record = { id: `history-${state.histories.length + 1}`, ...data };
        state.histories.push(record);
        return record;
      }
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const record = { id: `audit-${state.audits.length + 1}`, ...data };
        state.audits.push(record);
        return record;
      }
    }
  } as unknown as Prisma.TransactionClient;
}

function makeDatabase(state: State) {
  return {
    async $transaction<T>(
      callback: (tx: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> {
      const draft = cloneState(state);
      const result = await callback(makeTx(draft));
      commitState(state, draft);
      return result;
    }
  };
}

async function expectAsyncCode(
  run: () => Promise<unknown>,
  code: ClientSelectionDecisionError['code']
) {
  await assert.rejects(
    run,
    (error) => error instanceof ClientSelectionDecisionError && error.code === code
  );
}

async function behavioralChecks() {
  const approved = initialState();
  const decideApproved = createClientSelectionDecisionService(makeDatabase(approved));
  const base = {
    requestId: 'request-1',
    batchId: 'batch-1',
    expectedRevision: 1,
    actor: { id: 'client-1' }
  };
  const partial = await decideApproved({
    ...base,
    batchItemId: 'item-1',
    decision: 'APPROVE'
  });
  assert.equal(partial.outcome, 'changed');
  assert.equal(partial.outcome === 'changed' && partial.batchOutcome, 'unchanged');
  assert.equal(approved.requests.get('request-1')?.status, 'WAITING_APPROVAL');

  const complete = await decideApproved({
    ...base,
    batchItemId: 'item-2',
    decision: 'APPROVE'
  });
  assert.equal(complete.outcome, 'changed');
  assert.equal(complete.outcome === 'changed' && complete.batchOutcome, 'approved');
  assert.equal(approved.batches.get('batch-1')?.status, 'APPROVED');
  assert.equal(approved.requests.get('request-1')?.status, 'AWAITING_INVOICE');
  assert.equal(approved.histories.length, 1);
  assert.equal(
    approved.audits.filter((audit) => audit.action === 'REQUEST_STATUS_CHANGED').length,
    1
  );
  assert.equal(
    approved.audits.filter(
      (audit) => audit.action === 'REQUEST_SELECTION_ITEM_APPROVED'
    ).length,
    2
  );

  const auditCount = approved.audits.length;
  const repeated = await decideApproved({
    ...base,
    batchItemId: 'item-2',
    decision: 'APPROVE'
  });
  assert.equal(repeated.outcome, 'noop');
  assert.equal(approved.audits.length, auditCount);
  assert.equal(approved.histories.length, 1);
  await expectAsyncCode(
    () => decideApproved({
      ...base,
      batchItemId: 'item-2',
      decision: 'REJECT',
      clientComment: 'Не підходить'
    }),
    'BATCH_ITEM_DECISION_CONFLICT'
  );

  const rejected = initialState();
  const decideRejected = createClientSelectionDecisionService(makeDatabase(rejected));
  const rejection = await decideRejected({
    ...base,
    batchItemId: 'item-1',
    decision: 'REJECT',
    clientComment: 'Потрібен інший виробник'
  });
  assert.equal(rejection.outcome, 'changed');
  assert.equal(rejection.outcome === 'changed' && rejection.batchOutcome, 'rejected');
  assert.equal(rejected.batches.get('batch-1')?.status, 'REJECTED');
  assert.equal(rejected.requests.get('request-1')?.status, 'WAITING_APPROVAL');
  assert.equal(rejected.histories.length, 0);
  assert.equal(
    rejected.items.get('item-1')?.clientComment,
    'Потрібен інший виробник'
  );
  const itemAudit = rejected.audits.find(
    (audit) => audit.action === 'REQUEST_SELECTION_ITEM_REJECTED'
  );
  assert.equal(
    JSON.stringify(itemAudit?.metadata).includes('Потрібен інший виробник'),
    false
  );

  const denied = initialState();
  const decideDenied = createClientSelectionDecisionService(makeDatabase(denied));
  await expectAsyncCode(
    () => decideDenied({
      ...base,
      batchItemId: 'item-1',
      decision: 'APPROVE',
      actor: { id: 'client-2' }
    }),
    'REQUEST_ACCESS_DENIED'
  );
  await expectAsyncCode(
    () => decideDenied({
      ...base,
      batchItemId: 'item-1',
      decision: 'APPROVE',
      actor: { id: 'admin-1' }
    }),
    'ACTOR_NOT_ALLOWED'
  );
  await expectAsyncCode(
    () => decideDenied({
      ...base,
      batchItemId: 'item-1',
      decision: 'APPROVE',
      expectedRevision: 2
    }),
    'STALE_SELECTION_REVISION'
  );
  denied.requests.get('request-1')!.status = 'IN_PROGRESS';
  await expectAsyncCode(
    () => decideDenied({
      ...base,
      batchItemId: 'item-1',
      decision: 'APPROVE'
    }),
    'REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION'
  );
}

behavioralChecks()
  .then(() => {
    console.log('Stage Request Status Automation 5 client approval checks passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
