import assert from 'node:assert/strict';

import type { Prisma, RequestStatus, UserRole } from '@prisma/client';

import {
  createRequestStatusTransitionService,
  REQUEST_STATUS_EVENTS,
  RequestStatusTransitionError,
  resolveRequestStatusTransition,
  type RequestStatusEvent
} from '../lib/requests/status-transition';

function expectDecision(
  currentStatus: RequestStatus,
  event: RequestStatusEvent,
  expected: ReturnType<typeof resolveRequestStatusTransition>
) {
  assert.deepEqual(resolveRequestStatusTransition(currentStatus, event), expected);
}

expectDecision('NEW', REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED, {
  outcome: 'allowed',
  nextStatus: 'IN_PROGRESS'
});
expectDecision('IN_PROGRESS', REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED, {
  outcome: 'noop',
  currentStatus: 'IN_PROGRESS',
  reason: 'idempotent_event'
});
expectDecision('IN_PROGRESS', REQUEST_STATUS_EVENTS.SELECTION_SENT_FOR_APPROVAL, {
  outcome: 'allowed',
  nextStatus: 'WAITING_APPROVAL'
});
expectDecision('WAITING_APPROVAL', REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED, {
  outcome: 'allowed',
  nextStatus: 'AWAITING_INVOICE'
});
expectDecision('WAITING_APPROVAL', REQUEST_STATUS_EVENTS.CLIENT_SELECTION_REJECTED_ALL, {
  outcome: 'allowed',
  nextStatus: 'CANCELLED'
});
expectDecision('AWAITING_INVOICE', REQUEST_STATUS_EVENTS.CLIENT_SELECTION_REJECTED_ALL, {
  outcome: 'allowed',
  nextStatus: 'CANCELLED'
});
expectDecision('AWAITING_INVOICE', REQUEST_STATUS_EVENTS.INVOICE_SENT, {
  outcome: 'allowed',
  nextStatus: 'INVOICE_SENT'
});
expectDecision('INVOICE_SENT', REQUEST_STATUS_EVENTS.INVOICE_SENT, {
  outcome: 'noop',
  currentStatus: 'INVOICE_SENT',
  reason: 'idempotent_event'
});
expectDecision('COMPLETED', REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED, {
  outcome: 'blocked',
  currentStatus: 'COMPLETED',
  reason: 'terminal_status'
});
expectDecision('CANCELLED', REQUEST_STATUS_EVENTS.INVOICE_SENT, {
  outcome: 'blocked',
  currentStatus: 'CANCELLED',
  reason: 'terminal_status'
});
expectDecision('AWAITING_SHIPMENT', REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED, {
  outcome: 'blocked',
  currentStatus: 'AWAITING_SHIPMENT',
  reason: 'manual_status_locked'
});
expectDecision('WAITING_APPROVAL', REQUEST_STATUS_EVENTS.INVOICE_SENT, {
  outcome: 'blocked',
  currentStatus: 'WAITING_APPROVAL',
  reason: 'invalid_transition'
});
expectDecision('WAITING_APPROVAL', REQUEST_STATUS_EVENTS.MANUAL_SET_CANCELLED, {
  outcome: 'allowed',
  nextStatus: 'CANCELLED'
});
expectDecision('AWAITING_SHIPMENT', REQUEST_STATUS_EVENTS.MANUAL_SET_COMPLETED, {
  outcome: 'allowed',
  nextStatus: 'COMPLETED'
});
expectDecision('WAITING_APPROVAL', REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED, {
  outcome: 'blocked',
  currentStatus: 'WAITING_APPROVAL',
  reason: 'invalid_transition'
});
expectDecision('ORDERED', REQUEST_STATUS_EVENTS.SELECTION_SENT_FOR_APPROVAL, {
  outcome: 'blocked',
  currentStatus: 'ORDERED',
  reason: 'manual_status_locked'
});
expectDecision('COMPLETED', REQUEST_STATUS_EVENTS.MANUAL_SET_COMPLETED, {
  outcome: 'noop',
  currentStatus: 'COMPLETED',
  reason: 'already_in_target_status'
});

type StoredAudit = Record<string, unknown>;
type StoredHistory = {
  id: string;
  requestId: string;
  oldStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedByUserId: string | null;
};

type TestState = {
  requestExists: boolean;
  requestStatus: RequestStatus;
  histories: StoredHistory[];
  audits: StoredAudit[];
};

type WriterOptions = {
  failHistory?: boolean;
  failAudit?: boolean;
  concurrentStatus?: RequestStatus;
};

const users = {
  admin: { id: 'admin', name: 'Admin User', email: 'ADMIN@EXAMPLE.COM', role: 'ADMIN' as UserRole },
  manager: { id: 'manager', name: 'Manager User', email: 'manager@example.com', role: 'MANAGER' as UserRole },
  client: { id: 'client', name: 'Client User', email: 'client@example.com', role: 'CLIENT' as UserRole }
};

function cloneState(state: TestState): TestState {
  return {
    requestExists: state.requestExists,
    requestStatus: state.requestStatus,
    histories: state.histories.map((entry) => ({ ...entry })),
    audits: state.audits.map((entry) => ({ ...entry }))
  };
}

function makeWriter(state: TestState, options: WriterOptions = {}) {
  let concurrentApplied = false;
  return {
    request: {
      findUnique: async () => state.requestExists
        ? { id: 'request-1', requestNumber: 'KP-1', status: state.requestStatus }
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
        if (!state.requestExists || where.id !== 'request-1' || state.requestStatus !== where.status) {
          return { count: 0 };
        }
        state.requestStatus = data.status;
        return { count: 1 };
      }
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users[where.id as keyof typeof users] ?? null
    },
    requestStatusHistory: {
      create: async ({ data }: { data: Omit<StoredHistory, 'id'> }) => {
        if (options.failHistory) throw new Error('history-write-failed');
        const record = { id: `history-${state.histories.length + 1}`, ...data };
        state.histories.push(record);
        return { id: record.id };
      }
    },
    auditLog: {
      create: async ({ data }: { data: StoredAudit }) => {
        if (options.failAudit) throw new Error('audit-write-failed');
        const record = { id: `audit-${state.audits.length + 1}`, ...data };
        state.audits.push(record);
        return record;
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
      state.histories = draft.histories;
      state.audits = draft.audits;
      return result;
    }
  };
  return { database, transactionCalls: () => transactionCalls };
}

function initialState(status: RequestStatus = 'NEW'): TestState {
  return { requestExists: true, requestStatus: status, histories: [], audits: [] };
}

async function expectDomainError(
  promise: Promise<unknown>,
  code: RequestStatusTransitionError['code']
) {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof RequestStatusTransitionError && error.code === code
  );
}

async function main() {
  const successState = initialState();
  const successDb = makeDatabase(successState);
  const transition = createRequestStatusTransitionService(successDb.database);
  const changed = await transition({
    requestId: 'request-1',
    event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
    actor: { id: 'manager' },
    reason: 'First draft item was created.',
    metadata: {
      source: 'ADMIN_CRM',
      eventKey: 'request-item:item-1',
      triggerEntityType: 'REQUEST_ITEM',
      triggerEntityId: 'item-1'
    }
  });

  assert.deepEqual(changed, {
    outcome: 'changed',
    previousStatus: 'NEW',
    nextStatus: 'IN_PROGRESS',
    historyId: 'history-1',
    auditLogId: 'audit-1'
  });
  assert.equal(successDb.transactionCalls(), 1, 'standalone mode must open one transaction');
  assert.equal(successState.requestStatus, 'IN_PROGRESS');
  assert.equal(successState.histories.length, 1);
  assert.equal(successState.audits.length, 1);
  assert.deepEqual(successState.histories[0], {
    id: 'history-1',
    requestId: 'request-1',
    oldStatus: 'NEW',
    newStatus: 'IN_PROGRESS',
    changedByUserId: 'manager'
  });
  assert.equal(successState.audits[0]?.actorName, 'Manager User');
  assert.equal(successState.audits[0]?.actorEmail, 'manager@example.com');
  assert.equal(successState.audits[0]?.actorRole, 'MANAGER');
  assert.deepEqual(successState.audits[0]?.oldValue, { status: 'NEW' });
  assert.deepEqual(successState.audits[0]?.newValue, { status: 'IN_PROGRESS' });
  assert.deepEqual(successState.audits[0]?.metadata, {
    automatic: true,
    businessEvent: 'SELECTION_DRAFT_CREATED',
    eventKey: 'request-item:item-1',
    reason: 'First draft item was created.',
    source: 'ADMIN_CRM',
    triggerEntityId: 'item-1',
    triggerEntityType: 'REQUEST_ITEM'
  });
  assert.equal('password' in (successState.audits[0]?.oldValue as Record<string, unknown>), false);

  const noopState = initialState('INVOICE_SENT');
  const noopDb = makeDatabase(noopState);
  const noopResult = await createRequestStatusTransitionService(noopDb.database)({
    requestId: 'request-1',
    event: REQUEST_STATUS_EVENTS.INVOICE_SENT,
    actor: { id: 'admin' }
  });
  assert.deepEqual(noopResult, {
    outcome: 'noop',
    currentStatus: 'INVOICE_SENT',
    reason: 'idempotent_event'
  });
  assert.equal(noopState.histories.length, 0);
  assert.equal(noopState.audits.length, 0);

  const blockedState = initialState('COMPLETED');
  const blockedResult = await createRequestStatusTransitionService(makeDatabase(blockedState).database)({
    requestId: 'request-1',
    event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
    actor: { id: 'manager' }
  });
  assert.deepEqual(blockedResult, {
    outcome: 'blocked',
    currentStatus: 'COMPLETED',
    reason: 'terminal_status'
  });
  assert.equal(blockedState.requestStatus, 'COMPLETED');
  assert.equal(blockedState.histories.length, 0);
  assert.equal(blockedState.audits.length, 0);

  const missingState = initialState();
  missingState.requestExists = false;
  await expectDomainError(
    createRequestStatusTransitionService(makeDatabase(missingState).database)({
      requestId: 'missing',
      event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
      actor: { id: 'manager' }
    }),
    'REQUEST_NOT_FOUND'
  );

  const clientManualState = initialState('IN_PROGRESS');
  await expectDomainError(
    createRequestStatusTransitionService(makeDatabase(clientManualState).database)({
      requestId: 'request-1',
      event: REQUEST_STATUS_EVENTS.MANUAL_SET_CANCELLED,
      actor: { id: 'client' }
    }),
    'ROLE_NOT_ALLOWED'
  );
  assert.equal(clientManualState.requestStatus, 'IN_PROGRESS');

  const clientRejectedAllState = initialState('WAITING_APPROVAL');
  const clientRejectedAll = await createRequestStatusTransitionService(
    makeDatabase(clientRejectedAllState).database
  )({
    requestId: 'request-1',
    event: REQUEST_STATUS_EVENTS.CLIENT_SELECTION_REJECTED_ALL,
    actor: { id: 'client' }
  });
  assert.equal(clientRejectedAll.outcome, 'changed');
  assert.equal(clientRejectedAllState.requestStatus, 'CANCELLED');
  assert.equal(clientRejectedAllState.histories.length, 1);
  assert.equal(clientRejectedAllState.audits.length, 1);

  const managerClientEventState = initialState('WAITING_APPROVAL');
  await expectDomainError(
    createRequestStatusTransitionService(makeDatabase(managerClientEventState).database)({
      requestId: 'request-1',
      event: REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED,
      actor: { id: 'manager' }
    }),
    'ROLE_NOT_ALLOWED'
  );

  const concurrentNoopState = initialState('NEW');
  const concurrentNoop = await createRequestStatusTransitionService(
    makeDatabase(concurrentNoopState, { concurrentStatus: 'IN_PROGRESS' }).database
  )({
    requestId: 'request-1',
    event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
    actor: { id: 'manager' }
  });
  assert.equal(concurrentNoop.outcome, 'noop');
  assert.equal(concurrentNoopState.histories.length, 0);
  assert.equal(concurrentNoopState.audits.length, 0);

  const concurrentErrorState = initialState('NEW');
  await expectDomainError(
    createRequestStatusTransitionService(
      makeDatabase(concurrentErrorState, { concurrentStatus: 'NEW' }).database
    )({
      requestId: 'request-1',
      event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
      actor: { id: 'manager' }
    }),
    'CONCURRENT_STATUS_CHANGE'
  );

  const externalState = initialState();
  const externalDb = makeDatabase(externalState);
  const externalTransition = createRequestStatusTransitionService(externalDb.database);
  const externalTx = makeWriter(externalState);
  await externalTransition({
    requestId: 'request-1',
    event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
    actor: { id: 'admin' },
    tx: externalTx
  });
  assert.equal(externalDb.transactionCalls(), 0, 'existing tx mode must not open a nested transaction');
  assert.equal(externalState.requestStatus, 'IN_PROGRESS');

  const historyFailureState = initialState();
  const historyFailureDb = makeDatabase(historyFailureState, { failHistory: true });
  await assert.rejects(
    createRequestStatusTransitionService(historyFailureDb.database)({
      requestId: 'request-1',
      event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
      actor: { id: 'manager' }
    }),
    /history-write-failed/
  );
  assert.equal(historyFailureState.requestStatus, 'NEW');
  assert.equal(historyFailureState.histories.length, 0);
  assert.equal(historyFailureState.audits.length, 0);

  const auditFailureState = initialState();
  const auditFailureDb = makeDatabase(auditFailureState, { failAudit: true });
  await assert.rejects(
    createRequestStatusTransitionService(auditFailureDb.database)({
      requestId: 'request-1',
      event: REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
      actor: { id: 'manager' }
    }),
    /audit-write-failed/
  );
  assert.equal(auditFailureState.requestStatus, 'NEW');
  assert.equal(auditFailureState.histories.length, 0);
  assert.equal(auditFailureState.audits.length, 0);

  console.log('Request status transition unit/integration verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
