import assert from 'node:assert/strict';

import { RequestSelectionBatchError } from '../lib/request-selection/service';
import {
  createSendRequestSelectionForApprovalService,
  SendRequestSelectionForApprovalError
} from '../lib/request-selection/send-for-approval';

type FakeItem = {
  id: string;
  requestId: string;
  updatedAt: Date;
  visibleToClient: boolean;
  approvedByClient: boolean;
  approvedAt: Date | null;
  includeInInvoice: boolean;
  salePrice: number | null;
};

type FakeState = {
  request: {
    id: string;
    requestNumber: string;
    companyId: string;
    status: string;
  } | null;
  items: FakeItem[];
  activeBatch: {
    id: string;
    revision: number;
    items: Array<{ sourceRequestItemId: string | null; sourceUpdatedAt: Date }>;
  } | null;
  pendingBatch: { id: string; revision: number; itemIds: string[] } | null;
  nextRevision: number;
  statusHistory: number;
  events: string[];
  audits: string[];
};

type FailurePoint =
  | 'create'
  | 'snapshot'
  | 'supersede'
  | 'send'
  | 'request-status'
  | 'audit'
  | 'visibility'
  | 'active-conflict';

function cloneState(state: FakeState): FakeState {
  return structuredClone(state);
}

function baseState(status = 'IN_PROGRESS'): FakeState {
  return {
    request: {
      id: 'request-1',
      requestNumber: 'KP-1001',
      companyId: 'company-1',
      status
    },
    items: [
      {
        id: 'item-new',
        requestId: 'request-1',
        updatedAt: new Date('2026-07-27T10:00:00.000Z'),
        visibleToClient: false,
        approvedByClient: true,
        approvedAt: new Date('2026-07-27T09:00:00.000Z'),
        includeInInvoice: true,
        salePrice: null
      }
    ],
    activeBatch: null,
    pendingBatch: null,
    nextRevision: 1,
    statusHistory: 0,
    events: [],
    audits: []
  };
}

function createHarness(initial: FakeState, failure?: FailurePoint, actorRole = 'ADMIN') {
  let state = cloneState(initial);
  let transactionCommitted = false;
  let notificationCalls = 0;
  let notifyFails = false;
  let working: FakeState | null = null;

  const database = {
    async $transaction<T>(callback: (tx: never) => Promise<T>) {
      const candidate = cloneState(state);
      working = candidate;
      const tx = {
        request: {
          findUnique: async () => candidate.request,
          update: async () => {
            throw new Error('Unexpected direct Request update.');
          }
        },
        requestSelectionBatch: {
          findFirst: async () => candidate.activeBatch
        },
        requestItem: {
          findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
            candidate.items.filter((item) => where.id.in.includes(item.id)),
          updateMany: async ({
            where,
            data
          }: {
            where: { requestId: string; id: { in: string[] } };
            data: Partial<FakeItem>;
          }) => {
            const isSelectedVisibilityUpdate = data.visibleToClient === true;
            if (failure === 'visibility' && isSelectedVisibilityUpdate) return { count: 0 };
            let count = 0;
            candidate.items = candidate.items.map((item) => {
              if (item.requestId !== where.requestId || !where.id.in.includes(item.id)) return item;
              count += 1;
              return { ...item, ...data, updatedAt: new Date('2026-07-27T11:00:00.000Z') };
            });
            return { count };
          }
        },
        user: {
          findUnique: async ({ where }: { where: { id: string } }) => where.id === 'missing-actor'
            ? null
            : ({
            id: where.id,
            name: 'Manager',
            email: 'manager@example.test',
            role: where.id === 'client-actor' ? 'CLIENT' : actorRole,
            status: where.id === 'inactive-actor' ? 'DISABLED' : 'ACTIVE'
          })
        },
        auditLog: {
          create: async ({ data }: { data: { action: string } }) => {
            if (failure === 'audit') throw new Error('audit failed');
            candidate.audits.push(data.action);
            return { id: `audit-${candidate.audits.length}`, ...data };
          }
        }
      };

      try {
        const result = await callback(tx as never);
        state = candidate;
        transactionCommitted = true;
        return result;
      } finally {
        working = null;
      }
    }
  };

  const dependencies = {
    async createBatch(input: {
      requestId: string;
      requestItemIds: string[];
      actor: { id: string };
    }) {
      const current = working!;
      if (input.actor.id === 'client-actor' || input.actor.id === 'inactive-actor') {
        throw new RequestSelectionBatchError('ACTOR_NOT_ALLOWED', {
          requestId: input.requestId
        });
      }
      if (failure === 'snapshot') {
        throw new RequestSelectionBatchError('SOURCE_ITEM_INVALID', {
          requestId: input.requestId,
          requestItemId: input.requestItemIds[0]
        });
      }
      if (failure === 'create') {
        throw new RequestSelectionBatchError('BATCH_CREATE_FAILED', {
          requestId: input.requestId
        });
      }
      assert.equal(
        current.items.find((item) => item.id === input.requestItemIds[0])?.salePrice,
        null,
        'nullable price must remain null before snapshot delegation'
      );
      const revision = current.nextRevision++;
      current.pendingBatch = {
        id: `batch-${revision}`,
        revision,
        itemIds: [...input.requestItemIds]
      };
      current.audits.push('REQUEST_SELECTION_BATCH_CREATED');
      current.events.push(`create:${revision}`);
      return {
        batchId: `batch-${revision}`,
        requestId: input.requestId,
        revision,
        status: 'DRAFT' as const,
        itemCount: input.requestItemIds.length,
        snapshotSchemaVersion: 1,
        snapshotHash: 'a'.repeat(64),
        auditLogId: 'audit-create'
      };
    },
    async transitionBatch(input: { batchId: string; event: string }) {
      const current = working!;
      if (input.event === 'SUPERSEDE') {
        if (failure === 'supersede') {
          throw new RequestSelectionBatchError('CONCURRENT_BATCH_STATUS_CHANGE', {
            batchId: input.batchId,
            event: 'SUPERSEDE'
          });
        }
        current.events.push(`supersede:${input.batchId}`);
        current.audits.push('REQUEST_SELECTION_BATCH_SUPERSEDED');
        current.activeBatch = null;
        return {
          outcome: 'changed' as const,
          previousStatus: 'SENT' as const,
          nextStatus: 'SUPERSEDED' as const,
          auditLogId: 'audit-supersede'
        };
      }
      if (failure === 'active-conflict') {
        throw new RequestSelectionBatchError('ACTIVE_SENT_BATCH_CONFLICT', {
          batchId: input.batchId,
          event: 'SEND'
        });
      }
      if (failure === 'send') {
        throw new RequestSelectionBatchError('CONCURRENT_BATCH_STATUS_CHANGE', {
          batchId: input.batchId,
          event: 'SEND'
        });
      }
      const pending = current.pendingBatch!;
      current.activeBatch = {
        id: pending.id,
        revision: pending.revision,
        items: pending.itemIds.map((id) => ({
          sourceRequestItemId: id,
          sourceUpdatedAt: initial.items.find((item) => item.id === id)!.updatedAt
        }))
      };
      current.events.push(`send:${input.batchId}`);
      current.audits.push('REQUEST_SELECTION_BATCH_SENT');
      return {
        outcome: 'changed' as const,
        previousStatus: 'DRAFT' as const,
        nextStatus: 'SENT' as const,
        auditLogId: 'audit-send'
      };
    },
    async transitionRequest() {
      const current = working!;
      if (failure === 'request-status') throw new Error('request status transition failed');
      if (current.request!.status === 'WAITING_APPROVAL') {
        current.events.push('request-status:noop');
        return {
          outcome: 'noop' as const,
          currentStatus: 'WAITING_APPROVAL' as const,
          reason: 'idempotent_event' as const
        };
      }
      const previousStatus = current.request!.status as 'IN_PROGRESS' | 'OFFER_PREPARING';
      current.request!.status = 'WAITING_APPROVAL';
      current.statusHistory += 1;
      current.audits.push('REQUEST_STATUS_CHANGED');
      current.events.push('request-status:changed');
      return {
        outcome: 'changed' as const,
        previousStatus,
        nextStatus: 'WAITING_APPROVAL' as const,
        historyId: 'history-1',
        auditLogId: 'audit-status'
      };
    },
    async notify() {
      notificationCalls += 1;
      assert.equal(transactionCommitted, true, 'Telegram must run only after commit');
      if (notifyFails) return { status: 'failed' as const, notificationId: 'notification-1' };
      return { status: 'sent' as const, notificationId: 'notification-1' };
    }
  };

  const service = createSendRequestSelectionForApprovalService(
    database as never,
    dependencies as never
  );

  return {
    service,
    getState: () => cloneState(state),
    getNotificationCalls: () => notificationCalls,
    setNotifyFails: () => {
      notifyFails = true;
    }
  };
}

function input(
  itemId = 'item-new',
  updatedAt = new Date('2026-07-27T10:00:00.000Z'),
  actorId = 'actor-1'
) {
  return {
    requestId: 'request-1',
    requestItemIds: [itemId],
    expectedRequestItemVersions: [{ id: itemId, updatedAt }],
    actor: { id: actorId }
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: SendRequestSelectionForApprovalError['code']
) {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof SendRequestSelectionForApprovalError && error.code === code
  );
}

async function main() {
  {
    const harness = createHarness(baseState());
    const result = await harness.service(input());
    const state = harness.getState();
    assert.equal(result.revision, 1);
    assert.equal(state.activeBatch?.revision, 1);
    assert.equal(state.request?.status, 'WAITING_APPROVAL');
    assert.equal(state.statusHistory, 1);
    assert.equal(state.items[0].visibleToClient, true);
    assert.equal(state.items[0].approvedByClient, false);
    assert.equal(state.items[0].approvedAt, null);
    assert.equal(state.items[0].includeInInvoice, false);
    assert.equal(state.items[0].salePrice, null);
    assert.deepEqual(
      state.audits,
      [
        'REQUEST_SELECTION_BATCH_CREATED',
        'REQUEST_SELECTION_BATCH_SENT',
        'REQUEST_ITEMS_SENT_FOR_APPROVAL',
        'REQUEST_STATUS_CHANGED'
      ]
    );
    assert.equal(result.notification.status, 'sent');
    assert.equal(harness.getNotificationCalls(), 1);
  }

  {
    const state = baseState('OFFER_PREPARING');
    const harness = createHarness(state, undefined, 'MANAGER');
    const result = await harness.service(input());
    assert.equal(harness.getState().request?.status, 'WAITING_APPROVAL');
    assert.equal(result.requestStatusTransition, 'changed');
  }

  {
    const state = baseState('WAITING_APPROVAL');
    const oldVersion = new Date('2026-07-27T08:00:00.000Z');
    state.items.unshift({
      id: 'item-old',
      requestId: 'request-1',
      updatedAt: oldVersion,
      visibleToClient: true,
      approvedByClient: true,
      approvedAt: oldVersion,
      includeInInvoice: true,
      salePrice: 125
    });
    state.activeBatch = {
      id: 'batch-1',
      revision: 1,
      items: [{ sourceRequestItemId: 'item-old', sourceUpdatedAt: oldVersion }]
    };
    state.nextRevision = 2;
    const harness = createHarness(state);
    const result = await harness.service(input());
    const after = harness.getState();
    assert.equal(result.revision, 2);
    assert.equal(result.supersededBatchId, 'batch-1');
    assert.equal(result.requestStatusTransition, 'noop');
    assert.equal(after.statusHistory, 0);
    assert.equal(after.items.find((item) => item.id === 'item-old')?.visibleToClient, false);
    assert.equal(after.items.find((item) => item.id === 'item-old')?.approvedByClient, true);
    assert.equal(after.audits.filter((action) => action === 'REQUEST_STATUS_CHANGED').length, 0);
    assert.ok(after.audits.includes('REQUEST_SELECTION_BATCH_SUPERSEDED'));
  }

  for (const status of [
    'AWAITING_INVOICE',
    'INVOICE_SENT',
    'AWAITING_SHIPMENT',
    'ORDERED',
    'IN_DELIVERY',
    'COMPLETED',
    'CANCELLED',
    'NEW'
  ]) {
    const harness = createHarness(baseState(status));
    await expectCode(
      harness.service(input()),
      'REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND'
    );
    assert.equal(harness.getNotificationCalls(), 0);
  }

  {
    const state = baseState('WAITING_APPROVAL');
    state.activeBatch = {
      id: 'batch-1',
      revision: 1,
      items: [{
        sourceRequestItemId: 'item-new',
        sourceUpdatedAt: state.items[0].updatedAt
      }]
    };
    const harness = createHarness(state);
    await expectCode(harness.service(input()), 'DUPLICATE_SEND_OPERATION');
    assert.equal(harness.getState().nextRevision, 1);
  }

  {
    const harness = createHarness(baseState());
    await expectCode(
      harness.service(input('item-new', new Date('2026-07-27T09:59:59.000Z'))),
      'SOURCE_ITEM_VERSION_CONFLICT'
    );
    assert.equal(harness.getState().nextRevision, 1);
  }

  {
    const harness = createHarness(baseState());
    await expectCode(
      harness.service({
        ...input(),
        requestItemIds: ['item-new', 'item-new'],
        expectedRequestItemVersions: [
          { id: 'item-new', updatedAt: new Date('2026-07-27T10:00:00.000Z') },
          { id: 'item-new', updatedAt: new Date('2026-07-27T10:00:00.000Z') }
        ]
      }),
      'DUPLICATE_REQUEST_ITEM_IDS'
    );
    await expectCode(
      harness.service({ ...input(), requestItemIds: [], expectedRequestItemVersions: [] }),
      'EMPTY_SELECTION'
    );
  }

  {
    const state = baseState();
    state.items.push({
      ...state.items[0],
      id: 'foreign-item',
      requestId: 'request-2'
    });
    const harness = createHarness(state);
    await expectCode(harness.service(input('foreign-item')), 'REQUEST_ITEM_NOT_IN_REQUEST');
    await expectCode(harness.service(input('missing-item')), 'REQUEST_ITEM_NOT_FOUND');
  }

  for (const actorId of ['client-actor', 'inactive-actor']) {
    const harness = createHarness(baseState());
    await expectCode(harness.service(input('item-new', baseState().items[0].updatedAt, actorId)), 'ACTOR_NOT_ALLOWED');
  }
  {
    const harness = createHarness(baseState());
    await expectCode(
      harness.service(input('item-new', baseState().items[0].updatedAt, 'missing-actor')),
      'ACTOR_NOT_FOUND'
    );
  }

  {
    const state = baseState();
    state.request = null;
    const harness = createHarness(state);
    await expectCode(harness.service(input()), 'REQUEST_NOT_FOUND');
  }

  for (const [failure, code] of [
    ['create', 'BATCH_CREATE_FAILED'],
    ['snapshot', 'SOURCE_ITEM_INVALID'],
    ['send', 'BATCH_SEND_FAILED'],
    ['request-status', 'REQUEST_STATUS_TRANSITION_FAILED'],
    ['audit', 'AUDIT_WRITE_FAILED'],
    ['visibility', 'VISIBILITY_UPDATE_FAILED'],
    ['active-conflict', 'ACTIVE_SENT_BATCH_CONFLICT']
  ] as const) {
    const harness = createHarness(baseState(), failure);
    await expectCode(harness.service(input()), code);
    const after = harness.getState();
    assert.equal(after.nextRevision, 1, `${failure} must roll back revision counter`);
    assert.equal(after.items[0].visibleToClient, false, `${failure} must roll back visibility`);
    assert.equal(after.statusHistory, 0, `${failure} must roll back request history`);
    assert.equal(harness.getNotificationCalls(), 0, `${failure} must not notify`);
  }

  {
    const state = baseState('WAITING_APPROVAL');
    state.activeBatch = {
      id: 'batch-1',
      revision: 1,
      items: [{
        sourceRequestItemId: 'item-old',
        sourceUpdatedAt: new Date('2026-07-27T08:00:00.000Z')
      }]
    };
    const harness = createHarness(state, 'supersede');
    await expectCode(harness.service(input()), 'BATCH_SUPERSEDE_FAILED');
    assert.equal(harness.getState().activeBatch?.id, 'batch-1');
  }

  {
    const harness = createHarness(baseState());
    harness.setNotifyFails();
    const result = await harness.service(input());
    assert.equal(result.notification.status, 'failed');
    assert.equal(result.notification.errorCode, 'TELEGRAM_NOTIFICATION_FAILED');
    assert.equal(harness.getState().activeBatch?.revision, 1);
    assert.equal(harness.getState().request?.status, 'WAITING_APPROVAL');
  }

  console.log('Stage 4C send-for-approval trigger checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
