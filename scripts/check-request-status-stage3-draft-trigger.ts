import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Prisma, RequestStatus, UserRole } from '@prisma/client';

import {
  createRequestItemDraftService,
  RequestItemDraftCreateError,
  requestStatusAllowsDraftItemCreation
} from '../lib/request-items/create-draft';
import { parseRequestItemInput, type RequestItemInput } from '../lib/request-items/validation';
import {
  REQUEST_STATUS_EVENTS,
  RequestStatusTransitionError,
  resolveRequestStatusTransition
} from '../lib/requests/status-transition';

type StoredItem = {
  id: string;
  requestId: string;
  vehicleId: string | null;
  equipmentType: string | null;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  supplierName: string | null;
  availability: string | null;
  purchasePrice: string | null;
  salePrice: string | null;
  currency: string;
  comment: string | null;
  visibleToClient: boolean;
  includeInInvoice: boolean;
};

type StoredHistory = {
  id: string;
  requestId: string;
  oldStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedByUserId: string | null;
};

type StoredAudit = Record<string, unknown>;

type TestState = {
  requestExists: boolean;
  requestStatus: RequestStatus;
  items: StoredItem[];
  histories: StoredHistory[];
  audits: StoredAudit[];
};

type WriterOptions = {
  failItemCreate?: boolean;
  failHistory?: boolean;
  failAuditAt?: number;
  concurrentStatus?: RequestStatus;
};

const users = {
  admin: {
    id: 'admin',
    name: 'Admin User',
    email: 'ADMIN@EXAMPLE.COM',
    role: 'ADMIN' as UserRole,
    status: 'ACTIVE'
  },
  manager: {
    id: 'manager',
    name: 'Manager User',
    email: 'manager@example.com',
    role: 'MANAGER' as UserRole,
    status: 'ACTIVE'
  },
  client: {
    id: 'client',
    name: 'Client User',
    email: 'client@example.com',
    role: 'CLIENT' as UserRole,
    status: 'ACTIVE'
  }
};

const validItem: RequestItemInput = {
  equipmentType: 'Трактор',
  name: 'Фільтр',
  brand: 'Test Brand',
  catalogNumber: 'TEST-1',
  quantity: 1,
  unit: 'шт',
  supplierName: null,
  availability: 'В наявності',
  purchasePrice: null,
  salePrice: '120.00',
  currency: 'UAH',
  comment: null,
  visibleToClient: true
};

function initialState(status: RequestStatus = 'NEW'): TestState {
  return {
    requestExists: true,
    requestStatus: status,
    items: [],
    histories: [],
    audits: []
  };
}

function cloneState(state: TestState): TestState {
  return {
    requestExists: state.requestExists,
    requestStatus: state.requestStatus,
    items: state.items.map((item) => ({ ...item })),
    histories: state.histories.map((history) => ({ ...history })),
    audits: state.audits.map((audit) => ({ ...audit }))
  };
}

function makeWriter(state: TestState, options: WriterOptions = {}) {
  let auditCalls = 0;
  let concurrentApplied = false;

  return {
    request: {
      findUnique: async () => state.requestExists
        ? {
            id: 'request-1',
            requestNumber: 'KP-1',
            status: state.requestStatus,
            vehicleId: 'vehicle-1',
            companyId: 'company-1'
          }
        : null,
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; status: RequestStatus };
        data: { status: RequestStatus };
      }) => {
        if (options.concurrentStatus && !concurrentApplied) {
          concurrentApplied = true;
          state.requestStatus = options.concurrentStatus;
          return { count: 0 };
        }
        if (!state.requestExists || where.id !== 'request-1' || where.status !== state.requestStatus) {
          return { count: 0 };
        }
        state.requestStatus = data.status;
        return { count: 1 };
      }
    },
    requestItem: {
      create: async ({ data }: { data: Omit<StoredItem, 'id' | 'includeInInvoice'> }) => {
        if (options.failItemCreate) throw new Error('request-item-create-failed');
        const item: StoredItem = {
          id: `item-${state.items.length + 1}`,
          ...data,
          includeInInvoice: false
        };
        state.items.push(item);
        return item;
      }
    },
    requestStatusHistory: {
      create: async ({ data }: { data: Omit<StoredHistory, 'id'> }) => {
        if (options.failHistory) throw new Error('history-write-failed');
        const history = {
          id: `history-${state.histories.length + 1}`,
          ...data
        };
        state.histories.push(history);
        return { id: history.id };
      }
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users[where.id as keyof typeof users] ?? null
    },
    requestSelectionBatch: {
      findMany: async () => state.requestStatus === 'WAITING_APPROVAL'
        ? [{ id: 'batch-sent', revision: 1, status: 'SENT' }]
        : [],
      findFirst: async () => null
    },
    auditLog: {
      create: async ({ data }: { data: StoredAudit }) => {
        auditCalls += 1;
        if (options.failAuditAt === auditCalls) throw new Error(`audit-${auditCalls}-write-failed`);
        const audit = {
          id: `audit-${state.audits.length + 1}`,
          ...data
        };
        state.audits.push(audit);
        return audit;
      }
    }
  } as unknown as Prisma.TransactionClient;
}

function makeDatabase(state: TestState, options: WriterOptions = {}) {
  let transactionCalls = 0;
  const database = {
    async $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
      transactionCalls += 1;
      const draft = cloneState(state);
      const result = await callback(makeWriter(draft, options));
      state.requestExists = draft.requestExists;
      state.requestStatus = draft.requestStatus;
      state.items = draft.items;
      state.histories = draft.histories;
      state.audits = draft.audits;
      return result;
    }
  };
  return {
    database,
    transactionCalls: () => transactionCalls
  };
}

function statusAuditCount(state: TestState) {
  return state.audits.filter((audit) => audit.action === 'REQUEST_STATUS_CHANGED').length;
}

function itemAuditCount(state: TestState) {
  return state.audits.filter((audit) => audit.action === 'REQUEST_ITEM_CREATED').length;
}

async function expectErrorCode(
  promise: Promise<unknown>,
  errorType: typeof RequestItemDraftCreateError | typeof RequestStatusTransitionError,
  code: string
) {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof errorType && error.code === code
  );
}

function assertNoBackwardTransition(status: RequestStatus) {
  const decision = resolveRequestStatusTransition(
    status,
    REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED
  );
  assert.notEqual(decision.outcome, 'allowed', `${status} must not transition back to IN_PROGRESS`);
}

async function main() {
  assert.deepEqual(
    resolveRequestStatusTransition('NEW', REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED),
    { outcome: 'allowed', nextStatus: 'IN_PROGRESS' }
  );
  assert.deepEqual(
    resolveRequestStatusTransition('IN_PROGRESS', REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED),
    { outcome: 'noop', currentStatus: 'IN_PROGRESS', reason: 'idempotent_event' }
  );
  for (const status of [
    'OFFER_PREPARING',
    'WAITING_APPROVAL',
    'AWAITING_INVOICE',
    'INVOICE_SENT',
    'AWAITING_SHIPMENT',
    'ORDERED',
    'IN_DELIVERY',
    'COMPLETED',
    'CANCELLED'
  ] as const) {
    assertNoBackwardTransition(status);
  }

  for (const status of [
    'NEW',
    'IN_PROGRESS',
    'OFFER_PREPARING',
    'WAITING_APPROVAL'
  ] as const) {
    assert.equal(requestStatusAllowsDraftItemCreation(status), true);
  }
  for (const status of [
    'AWAITING_INVOICE',
    'INVOICE_SENT',
    'AWAITING_SHIPMENT',
    'ORDERED',
    'IN_DELIVERY',
    'COMPLETED',
    'CANCELLED'
  ] as const) {
    assert.equal(requestStatusAllowsDraftItemCreation(status), false);
  }

  const firstState = initialState();
  const firstDb = makeDatabase(firstState);
  const createFirst = createRequestItemDraftService(firstDb.database);
  const firstResult = await createFirst({
    requestId: 'request-1',
    data: validItem,
    actor: { id: 'manager' }
  });

  assert.equal(firstDb.transactionCalls(), 1);
  assert.equal(firstState.items.length, 1);
  assert.equal(firstState.items[0]?.visibleToClient, false);
  assert.equal(firstState.requestStatus, 'IN_PROGRESS');
  assert.equal(firstState.histories.length, 1);
  assert.equal(statusAuditCount(firstState), 1);
  assert.equal(itemAuditCount(firstState), 1);
  assert.equal(firstResult.transition.outcome, 'changed');
  assert.deepEqual(firstState.histories[0], {
    id: 'history-1',
    requestId: 'request-1',
    oldStatus: 'NEW',
    newStatus: 'IN_PROGRESS',
    changedByUserId: 'manager'
  });

  const statusAudit = firstState.audits.find((audit) => audit.action === 'REQUEST_STATUS_CHANGED');
  assert.equal(statusAudit?.actorName, 'Manager User');
  assert.equal(statusAudit?.actorEmail, 'manager@example.com');
  assert.equal(statusAudit?.actorRole, 'MANAGER');
  assert.deepEqual(statusAudit?.oldValue, { status: 'NEW' });
  assert.deepEqual(statusAudit?.newValue, { status: 'IN_PROGRESS' });
  assert.deepEqual(statusAudit?.metadata, {
    automatic: true,
    businessEvent: 'SELECTION_DRAFT_CREATED',
    eventKey: 'request-item:item-1',
    reason: 'Підібрану позицію створено як чернетку',
    source: 'ADMIN_CRM',
    triggerEntityId: 'item-1',
    triggerEntityType: 'REQUEST_ITEM'
  });

  const createSecond = createRequestItemDraftService(makeDatabase(firstState).database);
  const secondResult = await createSecond({
    requestId: 'request-1',
    data: { ...validItem, catalogNumber: 'TEST-2' },
    actor: { id: 'admin' }
  });
  assert.equal(secondResult.transition.outcome, 'noop');
  assert.equal(firstState.items.length, 2);
  assert.equal(firstState.histories.length, 1);
  assert.equal(statusAuditCount(firstState), 1);
  assert.equal(itemAuditCount(firstState), 2);

  const waitingState = initialState('WAITING_APPROVAL');
  const waitingResult = await createRequestItemDraftService(
    makeDatabase(waitingState).database
  )({
    requestId: 'request-1',
    data: validItem,
    actor: { id: 'manager' }
  });
  assert.equal(waitingResult.transition.outcome, 'noop');
  assert.equal(waitingState.requestStatus, 'WAITING_APPROVAL');
  assert.equal(waitingState.items.length, 1);
  assert.equal(waitingState.histories.length, 0);
  assert.equal(itemAuditCount(waitingState), 1);

  const concurrentState = initialState();
  const concurrentDb = makeDatabase(concurrentState, { concurrentStatus: 'IN_PROGRESS' });
  const concurrentResult = await createRequestItemDraftService(concurrentDb.database)({
    requestId: 'request-1',
    data: validItem,
    actor: { id: 'manager' }
  });
  assert.equal(concurrentResult.transition.outcome, 'noop');
  assert.equal(concurrentState.items.length, 1);
  assert.equal(concurrentState.histories.length, 0);
  assert.equal(statusAuditCount(concurrentState), 0);
  assert.equal(itemAuditCount(concurrentState), 1);

  const invalidParsed = parseRequestItemInput({
    equipmentType: '',
    brand: '',
    name: '',
    quantity: 0
  });
  assert.equal(invalidParsed.ok, false);
  const invalidState = initialState();
  const invalidDb = makeDatabase(invalidState);
  assert.equal(invalidDb.transactionCalls(), 0);
  assert.equal(invalidState.items.length, 0);
  assert.equal(invalidState.requestStatus, 'NEW');

  const itemFailureState = initialState();
  await expectErrorCode(
    createRequestItemDraftService(makeDatabase(itemFailureState, { failItemCreate: true }).database)({
      requestId: 'request-1',
      data: validItem,
      actor: { id: 'manager' }
    }),
    RequestItemDraftCreateError,
    'REQUEST_ITEM_CREATE_FAILED'
  );
  assert.equal(itemFailureState.items.length, 0);
  assert.equal(itemFailureState.requestStatus, 'NEW');
  assert.equal(itemFailureState.histories.length, 0);
  assert.equal(itemFailureState.audits.length, 0);

  const historyFailureState = initialState();
  await assert.rejects(
    createRequestItemDraftService(makeDatabase(historyFailureState, { failHistory: true }).database)({
      requestId: 'request-1',
      data: validItem,
      actor: { id: 'manager' }
    }),
    /history-write-failed/
  );
  assert.equal(historyFailureState.items.length, 0);
  assert.equal(historyFailureState.requestStatus, 'NEW');
  assert.equal(historyFailureState.histories.length, 0);
  assert.equal(historyFailureState.audits.length, 0);

  const auditFailureState = initialState();
  await assert.rejects(
    createRequestItemDraftService(makeDatabase(auditFailureState, { failAuditAt: 2 }).database)({
      requestId: 'request-1',
      data: validItem,
      actor: { id: 'manager' }
    }),
    /audit-2-write-failed/
  );
  assert.equal(auditFailureState.items.length, 0);
  assert.equal(auditFailureState.requestStatus, 'NEW');
  assert.equal(auditFailureState.histories.length, 0);
  assert.equal(auditFailureState.audits.length, 0);

  for (const status of [
    'AWAITING_INVOICE',
    'INVOICE_SENT',
    'AWAITING_SHIPMENT',
    'ORDERED',
    'IN_DELIVERY',
    'COMPLETED',
    'CANCELLED'
  ] as const) {
    const terminalState = initialState(status);
    await expectErrorCode(
      createRequestItemDraftService(makeDatabase(terminalState).database)({
        requestId: 'request-1',
        data: validItem,
        actor: { id: 'manager' }
      }),
      RequestItemDraftCreateError,
      'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION'
    );
    assert.equal(terminalState.items.length, 0);
    assert.equal(terminalState.requestStatus, status);
    assert.equal(terminalState.histories.length, 0);
    assert.equal(terminalState.audits.length, 0);
  }

  const missingState = initialState();
  missingState.requestExists = false;
  await expectErrorCode(
    createRequestItemDraftService(makeDatabase(missingState).database)({
      requestId: 'other-request',
      data: validItem,
      actor: { id: 'manager' }
    }),
    RequestItemDraftCreateError,
    'REQUEST_NOT_FOUND'
  );
  assert.equal(missingState.items.length, 0);

  const clientState = initialState();
  await expectErrorCode(
    createRequestItemDraftService(makeDatabase(clientState).database)({
      requestId: 'request-1',
      data: validItem,
      actor: { id: 'client' }
    }),
    RequestItemDraftCreateError,
    'ACTOR_NOT_ALLOWED'
  );
  assert.equal(clientState.items.length, 0);
  assert.equal(clientState.requestStatus, 'NEW');
  assert.equal(clientState.histories.length, 0);
  assert.equal(clientState.audits.length, 0);

  const adminState = initialState();
  const adminResult = await createRequestItemDraftService(makeDatabase(adminState).database)({
    requestId: 'request-1',
    data: validItem,
    actor: { id: 'admin' }
  });
  assert.equal(adminResult.transition.outcome, 'changed');
  assert.equal(adminState.items.length, 1);

  const root = process.cwd();
  const actionSource = readFileSync(path.join(root, 'app/admin/actions.ts'), 'utf8');
  const apiSource = readFileSync(
    path.join(root, 'app/api/admin/requests/[id]/items/route.ts'),
    'utf8'
  );
  const createServiceSource = readFileSync(
    path.join(root, 'lib/request-items/create-draft.ts'),
    'utf8'
  );

  assert.match(actionSource, /requireCrmSession\(\)[\s\S]*createRequestItemDraft\(/);
  assert.match(apiSource, /getCrmApiSession\(\)[\s\S]*createRequestItemDraft\(/);
  assert.doesNotMatch(actionSource.slice(
    actionSource.indexOf('export async function createAdminRequestItem'),
    actionSource.indexOf('export async function updateAdminRequestItem')
  ), /requestItem\.create\(/);
  assert.doesNotMatch(apiSource, /requestItem\.create\(/);
  assert.match(createServiceSource, /visibleToClient:\s*false/);
  assert.match(createServiceSource, /event:\s*REQUEST_STATUS_EVENTS\.SELECTION_DRAFT_CREATED/);
  assert.doesNotMatch(createServiceSource, /SELECTION_SENT_FOR_APPROVAL|CLIENT_SELECTION_APPROVED|INVOICE_SENT/);

  console.log('Stage 3 draft selection trigger verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
