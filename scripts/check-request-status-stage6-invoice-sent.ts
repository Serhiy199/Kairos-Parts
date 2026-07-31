import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Prisma, type RequestStatus, type UserRole, type UserStatus } from '@prisma/client';

import {
  createSendInvoiceToClientService,
  type InvoiceSendAuditContext
} from '../lib/invoices/send-workflow';
import { REQUEST_STATUS_LABELS } from '../lib/requests/statuses';

type FakeTransaction = {
  readonly kind: 'fake-invoice-send-transaction';
};

type FakeState = {
  actorRole: UserRole;
  actorStatus: UserStatus;
  invoiceStatus: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';
  invoiceRequestId: string;
  requestStatus: RequestStatus;
  sentAt: Date | null;
  itemCount: number;
  invoiceAuditCount: number;
  requestAuditCount: number;
  historyCount: number;
  notificationCount: number;
};

type FakeOptions = {
  transitionFailure?: boolean;
  notificationFailure?: boolean;
};

const fixedSentAt = new Date('2026-07-29T09:30:00.000Z');
const invoiceId = 'invoice-stage6';
const requestId = 'request-stage6';
const actorId = 'actor-stage6';
const fakeTransaction: FakeTransaction = {
  kind: 'fake-invoice-send-transaction'
};

function createState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    actorRole: 'ADMIN',
    actorStatus: 'ACTIVE',
    invoiceStatus: 'DRAFT',
    invoiceRequestId: requestId,
    requestStatus: 'AWAITING_INVOICE',
    sentAt: null,
    itemCount: 1,
    invoiceAuditCount: 0,
    requestAuditCount: 0,
    historyCount: 0,
    notificationCount: 0,
    ...overrides
  };
}

function invoiceRecord(state: FakeState) {
  return {
    id: invoiceId,
    requestId: state.invoiceRequestId,
    selectionBatchId: 'batch-stage6',
    companyId: null,
    invoiceNumber: 'INV-STAGE6',
    status: state.invoiceStatus,
    currency: 'UAH' as const,
    subtotal: new Prisma.Decimal(1_000),
    totalAmount: new Prisma.Decimal(1_200),
    sentAt: state.sentAt,
    paidAt: null,
    cancelledAt: null,
    request: {
      requestNumber: 'REQ-STAGE6',
      status: state.requestStatus
    },
    selectionBatch: { revision: 1 },
    _count: { items: state.itemCount }
  };
}

function createService(state: FakeState, options: FakeOptions = {}) {
  return createSendInvoiceToClientService<
    FakeTransaction,
    ReturnType<typeof invoiceRecord>,
    InvoiceSendAuditContext
  >({
    async runTransaction(callback) {
      const snapshot = {
        ...state,
        sentAt: state.sentAt ? new Date(state.sentAt) : null
      };

      try {
        return await callback(fakeTransaction);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
    async findActor() {
      return {
        id: actorId,
        role: state.actorRole,
        status: state.actorStatus
      };
    },
    async findInvoice() {
      return invoiceRecord(state);
    },
    async markInvoiceSent(_tx, targetInvoiceId, sentAt) {
      if (targetInvoiceId !== invoiceId || state.invoiceStatus !== 'DRAFT') {
        return { count: 0 };
      }

      state.invoiceStatus = 'SENT';
      state.sentAt = sentAt;
      return { count: 1 };
    },
    async transitionRequest(_tx, input) {
      assert.equal(input.requestId, requestId);
      assert.equal(input.actorId, actorId);
      assert.equal(input.invoiceId, invoiceId);

      if (options.transitionFailure) {
        throw new Error('SIMULATED_REQUEST_TRANSITION_FAILURE');
      }

      assert.equal(state.requestStatus, 'AWAITING_INVOICE');
      state.requestStatus = 'INVOICE_SENT';
      state.historyCount += 1;
      state.requestAuditCount += 1;
      return {
        outcome: 'changed',
        previousStatus: 'AWAITING_INVOICE',
        nextStatus: 'INVOICE_SENT',
        historyId: 'history-stage6',
        auditLogId: 'audit-request-stage6'
      };
    },
    async writeInvoiceSentAudit() {
      state.invoiceAuditCount += 1;
    },
    async notify(targetInvoiceId) {
      assert.equal(targetInvoiceId, invoiceId);
      state.notificationCount += 1;
      if (options.notificationFailure) {
        throw new Error('SIMULATED_NOTIFICATION_FAILURE');
      }
    },
    now() {
      return fixedSentAt;
    }
  });
}

async function main() {
  const audit: InvoiceSendAuditContext = {
    actorId,
    actorRole: 'ADMIN'
  };

const successState = createState();
const successService = createService(successState);
const success = await successService({
  invoiceId,
  expectedRequestId: requestId,
  audit
});
assert.equal(success.ok, true);
assert.equal(success.outcome, 'sent');
assert.equal(success.notificationDelivered, true);
assert.equal(successState.invoiceStatus, 'SENT');
assert.equal(successState.sentAt?.toISOString(), fixedSentAt.toISOString());
assert.equal(successState.requestStatus, 'INVOICE_SENT');
assert.equal(successState.historyCount, 1);
assert.equal(successState.requestAuditCount, 1);
assert.equal(successState.invoiceAuditCount, 1);
assert.equal(successState.notificationCount, 1);

const originalSentAt = successState.sentAt;
const repeat = await successService({
  invoiceId,
  expectedRequestId: requestId,
  audit
});
assert.equal(repeat.ok, true);
assert.equal(repeat.outcome, 'noop');
assert.equal(successState.sentAt, originalSentAt);
assert.equal(successState.historyCount, 1);
assert.equal(successState.requestAuditCount, 1);
assert.equal(successState.invoiceAuditCount, 1);
assert.equal(successState.notificationCount, 1);

const clientState = createState({ actorRole: 'CLIENT' });
const clientResult = await createService(clientState)({
  invoiceId,
  expectedRequestId: requestId,
  audit: { actorId, actorRole: 'CLIENT' }
});
assert.deepEqual(clientResult, { ok: false, status: 'invoice-forbidden' });
assert.equal(clientState.invoiceStatus, 'DRAFT');

const inactiveState = createState({ actorStatus: 'DISABLED' });
const inactiveResult = await createService(inactiveState)({
  invoiceId,
  expectedRequestId: requestId,
  audit
});
assert.deepEqual(inactiveResult, { ok: false, status: 'invoice-forbidden' });

const mismatchState = createState();
const mismatchResult = await createService(mismatchState)({
  invoiceId,
  expectedRequestId: 'another-request',
  audit
});
assert.deepEqual(mismatchResult, {
  ok: false,
  status: 'invoice-request-mismatch'
});
assert.equal(mismatchState.invoiceStatus, 'DRAFT');

const wrongStatusState = createState({ requestStatus: 'WAITING_APPROVAL' });
const wrongStatusResult = await createService(wrongStatusState)({
  invoiceId,
  expectedRequestId: requestId,
  audit
});
assert.deepEqual(wrongStatusResult, {
  ok: false,
  status: 'invoice-request-not-awaiting-send'
});
assert.equal(wrongStatusState.invoiceStatus, 'DRAFT');

const rollbackState = createState();
await assert.rejects(
  createService(rollbackState, { transitionFailure: true })({
    invoiceId,
    expectedRequestId: requestId,
    audit
  }),
  /SIMULATED_REQUEST_TRANSITION_FAILURE/
);
assert.equal(rollbackState.invoiceStatus, 'DRAFT');
assert.equal(rollbackState.requestStatus, 'AWAITING_INVOICE');
assert.equal(rollbackState.sentAt, null);
assert.equal(rollbackState.invoiceAuditCount, 0);

const notificationFailureState = createState();
const notificationFailure = await createService(notificationFailureState, {
  notificationFailure: true
})({
  invoiceId,
  expectedRequestId: requestId,
  audit
});
assert.equal(notificationFailure.ok, true);
assert.equal(notificationFailure.outcome, 'sent');
assert.equal(notificationFailure.notificationDelivered, false);
assert.equal(notificationFailureState.invoiceStatus, 'SENT');
assert.equal(notificationFailureState.requestStatus, 'INVOICE_SENT');
assert.equal(notificationFailureState.historyCount, 1);
assert.equal(notificationFailureState.requestAuditCount, 1);
assert.equal(notificationFailureState.invoiceAuditCount, 1);

assert.equal(REQUEST_STATUS_LABELS.INVOICE_SENT, 'Рахунок надісланий');

const root = process.cwd();
const serviceSource = readFileSync(
  path.join(root, 'lib', 'invoices', 'service.ts'),
  'utf8'
);
const actionSource = readFileSync(
  path.join(root, 'app', 'admin', 'actions.ts'),
  'utf8'
);
const feedbackSource = readFileSync(
  path.join(root, 'lib', 'admin', 'request-feedback.ts'),
  'utf8'
);
const pageSource = readFileSync(
  path.join(root, 'app', 'admin', 'requests', '[id]', 'page.tsx'),
  'utf8'
);

assert.match(
  serviceSource,
  /event:\s*REQUEST_STATUS_EVENTS\.INVOICE_SENT/
);
assert.match(serviceSource, /tx\s*\n?\s*\}\)/);
assert.match(serviceSource, /where:\s*\{\s*id:\s*invoiceId,\s*status:\s*'DRAFT'/);
assert.doesNotMatch(
  serviceSource,
  /request\.update\(\{[\s\S]{0,300}status:\s*'INVOICE_SENT'/
);
assert.match(
  actionSource,
  /sendInvoiceToClient\(\{[\s\S]{0,220}expectedRequestId:\s*requestId/
);
assert.match(actionSource, /invoice-sent-notification-failed/);
assert.match(actionSource, /revalidatePath\(`\/admin\/requests\/\$\{requestId\}`\)/);
assert.match(feedbackSource, /Рахунок надіслано клієнту\./);
assert.match(
  feedbackSource,
  /Рахунок надіслано в кабінет клієнта, але повідомлення не доставлено\./
);
assert.match(
  feedbackSource,
  /Не вдалося надіслати рахунок\. Спробуйте ще раз\./
);
assert.match(
  pageSource,
  /ReactiveActionForm action=\{sendAdminInvoice\}[\s\S]{0,500}pendingLabel="Надсилаємо…"/
);
assert.doesNotMatch(actionSource, /window\.location|location\.reload/);

  console.log(
    'Stage 6 invoice sent transaction, idempotency, guards, notification, and reactive UX checks passed.'
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
