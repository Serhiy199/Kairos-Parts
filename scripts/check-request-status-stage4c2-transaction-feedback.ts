import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getAdminRequestFeedback } from '../lib/admin/request-feedback';
import {
  createSendRequestSelectionForApprovalService,
  isExpiredPrismaTransactionError,
  REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS,
  SendRequestSelectionForApprovalError
} from '../lib/request-selection/send-for-approval';

type State = {
  counter: number;
  oldBatchStatus: 'SENT' | 'SUPERSEDED';
  newBatchStatus: 'NONE' | 'DRAFT' | 'SENT';
  itemVisible: boolean;
  itemApproved: boolean;
  auditCount: number;
};

const itemVersion = new Date('2026-07-28T10:00:00.000Z');

function expiredTransactionError() {
  return Object.assign(
    new Error(
      'Transaction API error: Transaction not found. Transaction ID refers to an old closed transaction.'
    ),
    { code: 'P2028' }
  );
}

function createHarness() {
  let state: State = {
    counter: 1,
    oldBatchStatus: 'SENT',
    newBatchStatus: 'NONE',
    itemVisible: true,
    itemApproved: true,
    auditCount: 0
  };
  let active = false;
  let committed = false;
  let failStatusTransition = true;
  let transactionOptions: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: string;
  } | undefined;
  let notificationInput: unknown;
  let transactionCount = 0;
  let working: State | null = null;
  let txReference: object | null = null;

  function requireActiveTransaction() {
    assert.equal(active, true, 'tx-bound query must finish before callback return');
    assert.ok(working);
    return working;
  }

  const database = {
    async $transaction<T>(
      callback: (tx: never) => Promise<T>,
      options?: { maxWait?: number; timeout?: number; isolationLevel?: string }
    ) {
      transactionCount += 1;
      transactionOptions = options;
      const candidate = structuredClone(state);
      working = candidate;
      active = true;
      committed = false;

      const tx = {
        request: {
          findUnique: async () => {
            requireActiveTransaction();
            return {
              id: 'request-1',
              requestNumber: 'KP-1001',
              companyId: 'company-1',
              status: 'WAITING_APPROVAL'
            };
          }
        },
        user: {
          findUnique: async () => {
            requireActiveTransaction();
            return {
              id: 'actor-1',
              name: 'Manager',
              email: 'manager@example.test',
              role: 'MANAGER',
              status: 'ACTIVE'
            };
          }
        },
        requestSelectionBatch: {
          findMany: async () => {
            const current = requireActiveTransaction();
            return current.oldBatchStatus === 'SENT'
              ? [{
                  id: 'batch-1',
                  revision: 1,
                  items: [{ sourceRequestItemId: 'item-1', sourceUpdatedAt: itemVersion }]
                }]
              : [];
          }
        },
        requestItem: {
          findMany: async () => {
            requireActiveTransaction();
            return [{
              id: 'item-1',
              requestId: 'request-1',
              updatedAt: itemVersion,
              visibleToClient: true
            }];
          },
          updateMany: async () => {
            const current = requireActiveTransaction();
            current.itemVisible = true;
            current.itemApproved = false;
            return { count: 1 };
          }
        },
        auditLog: {
          create: async () => {
            const current = requireActiveTransaction();
            current.auditCount += 1;
            return { id: `audit-${current.auditCount}` };
          }
        }
      };
      txReference = tx;

      try {
        const result = await callback(tx as never);
        assert.doesNotMatch(
          JSON.stringify(result),
          /transaction|txReference/,
          'transaction result must contain plain data only'
        );
        state = candidate;
        committed = true;
        return structuredClone(result);
      } finally {
        active = false;
        working = null;
        txReference = null;
      }
    }
  };

  const dependencies = {
    async getResendEligibility(input: { tx: object }) {
      requireActiveTransaction();
      assert.equal(input.tx, txReference);
      return {
        requestId: 'request-1',
        requestStatus: 'WAITING_APPROVAL',
        activeBatchId: 'batch-1',
        activeRevision: 1,
        items: [{
          requestItemId: 'item-1',
          activeBatchItemId: 'batch-item-1',
          state: 'CHANGED_AFTER_SEND',
          currentUpdatedAt: itemVersion.toISOString(),
          activeBatchSourceUpdatedAt: itemVersion.toISOString(),
          currentApprovalHash: 'current',
          activeApprovalHash: 'old'
        }],
        eligibleItemIds: ['item-1'],
        notSentItemIds: [],
        changedItemIds: ['item-1'],
        newItemIds: [],
        unchangedItemIds: [],
        removedBatchItemIds: [],
        canSend: true,
        reason: 'HAS_CHANGED_ITEMS'
      };
    },
    async transitionBatch(input: { event: string; tx: object }) {
      const current = requireActiveTransaction();
      assert.equal(input.tx, txReference, 'batch transition must use outer tx');
      if (input.event === 'SUPERSEDE') {
        current.oldBatchStatus = 'SUPERSEDED';
        return {
          outcome: 'changed',
          previousStatus: 'SENT',
          nextStatus: 'SUPERSEDED',
          auditLogId: 'audit-supersede'
        };
      }
      current.newBatchStatus = 'SENT';
      return {
        outcome: 'changed',
        previousStatus: 'DRAFT',
        nextStatus: 'SENT',
        auditLogId: 'audit-send'
      };
    },
    async createBatch(input: { tx: object }) {
      const current = requireActiveTransaction();
      assert.equal(input.tx, txReference, 'batch creation must use outer tx');
      current.counter += 1;
      current.newBatchStatus = 'DRAFT';
      return {
        batchId: 'batch-2',
        requestId: 'request-1',
        revision: current.counter,
        status: 'DRAFT',
        itemCount: 1,
        snapshotSchemaVersion: 1,
        snapshotHash: 'a'.repeat(64),
        auditLogId: 'audit-create'
      };
    },
    async transitionRequest(input: { tx: object }) {
      requireActiveTransaction();
      assert.equal(input.tx, txReference, 'request transition must use outer tx');
      if (failStatusTransition) throw expiredTransactionError();
      return {
        outcome: 'noop',
        currentStatus: 'WAITING_APPROVAL',
        reason: 'idempotent_event'
      };
    },
    async notify(input: { requestId: string }) {
      assert.equal(active, false, 'Telegram must run after transaction resolve');
      assert.equal(committed, true, 'Telegram must run only after commit');
      assert.deepEqual(Object.keys(input), ['requestId', 'updatedSelection']);
      notificationInput = structuredClone(input);
      return { status: 'sent', notificationId: 'notification-1' };
    }
  };

  return {
    service: createSendRequestSelectionForApprovalService(
      database as never,
      dependencies as never
    ),
    retry() {
      failStatusTransition = false;
    },
    getState: () => structuredClone(state),
    getTransactionOptions: () => transactionOptions,
    getNotificationInput: () => notificationInput,
    getTransactionCount: () => transactionCount
  };
}

async function main() {
  assert.equal(REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS.maxWait, 5_000);
  assert.ok(
    REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS.timeout > 5_000,
    'remote interactive transaction must not inherit the 5s default timeout'
  );

  const simulatedWorkloadMs = 6_000;
  assert.throws(
    () => {
      if (simulatedWorkloadMs > 5_000) throw expiredTransactionError();
    },
    /Transaction not found/,
    'the previous default timeout must reproduce the late-query failure'
  );
  assert.doesNotThrow(() => {
    if (simulatedWorkloadMs > REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS.timeout) {
      throw expiredTransactionError();
    }
  });

  assert.equal(isExpiredPrismaTransactionError(expiredTransactionError()), true);
  assert.equal(
    isExpiredPrismaTransactionError(
      new SendRequestSelectionForApprovalError(
        'REQUEST_STATUS_TRANSITION_FAILED',
        { requestId: 'request-1' },
        { cause: expiredTransactionError() }
      )
    ),
    true
  );
  assert.equal(isExpiredPrismaTransactionError(new Error('ordinary database error')), false);

  const harness = createHarness();
  const command = {
    requestId: 'request-1',
    requestItemIds: ['item-1'],
    expectedRequestItemVersions: [{ id: 'item-1', updatedAt: itemVersion }],
    expectedActiveBatchId: 'batch-1',
    expectedActiveRevision: 1,
    actor: { id: 'actor-1' }
  };

  await assert.rejects(
    harness.service(command),
    (error: unknown) =>
      error instanceof SendRequestSelectionForApprovalError
      && error.code === 'TRANSACTION_CLIENT_EXPIRED'
  );
  assert.deepEqual(harness.getState(), {
    counter: 1,
    oldBatchStatus: 'SENT',
    newBatchStatus: 'NONE',
    itemVisible: true,
    itemApproved: true,
    auditCount: 0
  });
  assert.equal(harness.getNotificationInput(), undefined);

  harness.retry();
  const result = await harness.service(command);
  assert.equal(result.revision, 2);
  assert.equal(result.requestStatusTransition, 'noop');
  assert.deepEqual(harness.getState(), {
    counter: 2,
    oldBatchStatus: 'SUPERSEDED',
    newBatchStatus: 'SENT',
    itemVisible: true,
    itemApproved: false,
    auditCount: 1
  });
  assert.deepEqual(harness.getTransactionOptions(), REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS);
  assert.deepEqual(harness.getNotificationInput(), {
    requestId: 'request-1',
    updatedSelection: true
  });
  assert.equal(harness.getTransactionCount(), 2, 'each attempt owns exactly one transaction');

  const success = getAdminRequestFeedback('items-sent-for-approval');
  const warning = getAdminRequestFeedback('items-sent-for-approval-notification-failed');
  const error = getAdminRequestFeedback('items-send-error');
  assert.equal(success?.tone, 'success');
  assert.match(success?.className ?? '', /border-success/);
  assert.doesNotMatch(success?.className ?? '', /danger/);
  assert.equal(warning?.tone, 'warning');
  assert.match(warning?.className ?? '', /border-accent/);
  assert.match(warning?.message ?? '', /Telegram-повідомлення не доставлено/);
  assert.equal(error?.tone, 'error');
  assert.match(error?.className ?? '', /border-danger/);
  assert.doesNotMatch(error?.className ?? '', /success/);
  assert.match(error?.message ?? '', /Спробуйте ще раз/);
  assert.equal(getAdminRequestFeedback('<script>alert(1)</script>'), null);
  assert.equal(getAdminRequestFeedback('items-send-error bg-success'), null);

  const sendSource = readFileSync('lib/request-selection/send-for-approval.ts', 'utf8');
  const actionSource = readFileSync('app/admin/actions.ts', 'utf8');
  const pageSource = readFileSync('app/admin/requests/[id]/page.tsx', 'utf8');
  const statusTransitionIndex = sendSource.indexOf('dependencies.transitionRequest({');
  const sendBatchIndex = sendSource.indexOf("event: 'SEND'");
  const visibilityIndex = sendSource.indexOf('const previousSourceIds');
  const transactionEndIndex = sendSource.indexOf(
    'REQUEST_SELECTION_SEND_TRANSACTION_OPTIONS\n      );'
  );
  const notifyIndex = sendSource.indexOf('dependencies.notify(');
  const sendActionSource = actionSource.slice(
    actionSource.indexOf('export async function sendAdminRequestItemsForApproval')
  );
  assert.ok(
    sendBatchIndex > 0
      && statusTransitionIndex > sendBatchIndex
      && statusTransitionIndex < visibilityIndex
  );
  assert.ok(transactionEndIndex > sendBatchIndex && notifyIndex > transactionEndIndex);
  assert.match(sendSource, /tx\s*\n\s*\}\);/);
  assert.doesNotMatch(sendSource.slice(transactionEndIndex, notifyIndex), /\btx\b/);
  assert.ok(
    sendActionSource.indexOf('await sendRequestSelectionForApproval({')
      < sendActionSource.indexOf("revalidatePath(`/admin/requests/${requestId}`)")
  );
  assert.match(pageSource, /role=\{feedback\.tone === 'error' \? 'alert' : 'status'\}/);
  assert.match(pageSource, /feedback\.className/);
  assert.doesNotMatch(pageSource, /query\.result.*className/);

  console.log('Stage 4C2 transaction lifetime and feedback checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
