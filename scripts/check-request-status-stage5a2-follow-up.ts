import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Prisma } from '@prisma/client';

import {
  deriveRequestSelectionFollowUpEligibility
} from '../lib/request-selection/resend-eligibility';
import {
  buildRequestSelectionSnapshot
} from '../lib/request-selection/snapshot';
import {
  assertRequestItemDeleteAllowed,
  RequestItemDeleteError
} from '../lib/request-items/delete';
import {
  InvoiceSelectionError,
  resolveInvoiceSelection
} from '../lib/invoices/selection';
import {
  REQUEST_STATUS_EVENTS,
  resolveRequestStatusTransition
} from '../lib/requests/status-transition';

const at = new Date('2026-07-28T12:00:00.000Z');

function liveItem(
  id: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id,
    requestId: 'request-1',
    createdAt: at,
    updatedAt: at,
    equipmentType: 'Трактор',
    name: `Позиція ${id}`,
    brand: 'MAN',
    catalogNumber: `CAT-${id}`,
    analogNumber: null,
    quantity: 1,
    unit: 'шт',
    availability: 'На складі',
    deliveryTime: null,
    salePrice: new Prisma.Decimal('100.00'),
    currency: 'UAH',
    comment: null,
    vehicleId: null,
    vehicle: null,
    ...overrides
  };
}

function snapshotItem(
  id: string,
  source: ReturnType<typeof liveItem>,
  status: 'APPROVED' | 'REJECTED',
  overrides: Partial<Record<string, unknown>> = {}
) {
  const snapshot = buildRequestSelectionSnapshot(source as never);
  return {
    id,
    status,
    ...snapshot,
    ...overrides
  };
}

function followUp(input: {
  items: ReturnType<typeof liveItem>[];
  sourceStatus?: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  sourceItems: ReturnType<typeof snapshotItem>[];
  historicalBatches?: Array<Record<string, unknown>>;
  invoice?: { id: string; status: 'DRAFT' | 'SENT' } | null;
  active?: boolean;
  requestStatus?: 'WAITING_APPROVAL' | 'AWAITING_INVOICE';
}) {
  const sourceBatch = {
    id: 'batch-1',
    revision: 1,
    status: input.sourceStatus ?? 'PARTIALLY_APPROVED',
    items: input.sourceItems
  };
  return deriveRequestSelectionFollowUpEligibility({
    request: {
      id: 'request-1',
      status: input.requestStatus ?? 'AWAITING_INVOICE',
      items: input.items
    } as never,
    activeBatch: input.active
      ? { id: 'batch-active', revision: 2, items: [] }
      : null,
    sourceBatch: sourceBatch as never,
    finalizedBatches: (input.historicalBatches
      ? [sourceBatch, ...input.historicalBatches]
      : [sourceBatch]) as never,
    currentInvoice: input.invoice ?? null
  });
}

function invoiceItem(
  id: string,
  sourceRequestItemId: string | null,
  status: 'APPROVED' | 'REJECTED',
  price = '100.00'
) {
  return {
    id,
    sourceRequestItemId,
    position: Number(id.replace(/\D/g, '')) || 1,
    status,
    itemName: `Snapshot ${id}`,
    brand: null,
    catalogNumber: null,
    analogNumber: null,
    quantity: 1,
    unit: 'шт',
    approvedUnitPrice: new Prisma.Decimal(price),
    currency: 'UAH',
    managerComment: null,
    invoiceItem: null
  };
}

async function main() {
  const approved = liveItem('approved');
  const rejected = liveItem('rejected');
  const replacement = liveItem('replacement');
  const changedRejected = liveItem('rejected', { quantity: 2 });
  const sourceItems = [
    snapshotItem('snapshot-approved', approved, 'APPROVED'),
    snapshotItem('snapshot-rejected', rejected, 'REJECTED')
  ];

  const eligibility = followUp({
    items: [approved, changedRejected, replacement],
    sourceItems
  });
  assert.equal(eligibility.mode, 'FOLLOW_UP_REJECTED');
  assert.equal(eligibility.reason, 'HAS_REJECTED_AND_NEW_ITEMS');
  assert.equal(eligibility.canSend, true);
  assert.deepEqual(eligibility.approvedLockedItemIds, ['approved']);
  assert.deepEqual(eligibility.changedRejectedItemIds, ['rejected']);
  assert.deepEqual(eligibility.newItemIds, ['replacement']);
  assert.deepEqual(
    eligibility.eligibleItemIds,
    ['rejected', 'replacement'],
    'delta batch must exclude previously approved items'
  );

  const unchanged = followUp({
    items: [approved, rejected],
    sourceItems
  });
  assert.equal(unchanged.canSend, false);
  assert.equal(unchanged.reason, 'NO_FOLLOW_UP_CHANGES');
  assert.deepEqual(unchanged.rejectedEditableItemIds, ['rejected']);

  const removed = followUp({
    items: [approved],
    sourceItems
  });
  assert.equal(removed.canSend, false);
  assert.deepEqual(removed.removedRejectedSourceIds, ['rejected']);

  const removedWithReplacement = followUp({
    items: [approved, replacement],
    sourceItems
  });
  assert.equal(removedWithReplacement.canSend, true);
  assert.deepEqual(removedWithReplacement.eligibleItemIds, ['replacement']);

  for (const [invoice, reason] of [
    [{ id: 'invoice-draft', status: 'DRAFT' }, 'INVOICE_DRAFT_EXISTS'],
    [{ id: 'invoice-sent', status: 'SENT' }, 'INVOICE_ALREADY_SENT']
  ] as const) {
    const guarded = followUp({
      items: [approved, changedRejected],
      sourceItems,
      invoice
    });
    assert.equal(guarded.canSend, false);
    assert.equal(guarded.reason, reason);
  }
  assert.equal(followUp({
    items: [approved, changedRejected],
    sourceItems,
    active: true
  }).reason, 'ACTIVE_SENT_BATCH_EXISTS');

  const latestRejectedWithOlderApproved = followUp({
    items: [approved, changedRejected],
    sourceStatus: 'REJECTED',
    sourceItems: [snapshotItem('new-rejected', rejected, 'REJECTED')],
    historicalBatches: [{
      id: 'older-partial',
      revision: 1,
      status: 'PARTIALLY_APPROVED',
      items: [snapshotItem('older-approved', approved, 'APPROVED')]
    }]
  });
  assert.deepEqual(latestRejectedWithOlderApproved.approvedLockedItemIds, ['approved']);
  assert.deepEqual(latestRejectedWithOlderApproved.eligibleItemIds, ['rejected']);

  await assert.rejects(
    () => assertRequestItemDeleteAllowed({
      requestItem: { findFirst: async () => ({ id: 'approved' }) },
      requestSelectionBatchItem: { findFirst: async () => ({ id: 'snapshot' }) },
      invoiceItem: { findFirst: async () => null }
    } as never, { requestItemId: 'approved', requestId: 'request-1' }),
    (error) =>
      error instanceof RequestItemDeleteError
      && error.code === 'APPROVED_REQUEST_ITEM_DELETE_BLOCKED'
  );
  await assert.doesNotReject(() => assertRequestItemDeleteAllowed({
    requestItem: { findFirst: async () => ({ id: 'rejected' }) },
    requestSelectionBatchItem: { findFirst: async () => null },
    invoiceItem: { findFirst: async () => null }
  } as never, { requestItemId: 'rejected', requestId: 'request-1' }));

  const invoiceDb = {
    request: {
      findUnique: async () => ({
        id: 'request-1',
        status: 'AWAITING_INVOICE',
        invoices: []
      })
    },
    requestSelectionBatch: {
      findMany: async () => [
        {
          id: 'revision-1',
          revision: 1,
          status: 'PARTIALLY_APPROVED',
          invoice: null,
          items: [
            invoiceItem('item-1', 'source-a', 'APPROVED', '100'),
            invoiceItem('item-2', 'source-b', 'REJECTED')
          ]
        },
        {
          id: 'revision-2',
          revision: 2,
          status: 'APPROVED',
          invoice: null,
          items: [
            invoiceItem('item-3', 'source-b', 'APPROVED', '200'),
            invoiceItem('item-4', null, 'APPROVED', '300')
          ]
        }
      ]
    }
  } as never;
  const cumulative = await resolveInvoiceSelection(invoiceDb, 'request-1');
  assert.deepEqual(
    cumulative.items.map((item) => item.id),
    ['item-1', 'item-3', 'item-4']
  );
  assert.equal(cumulative.approvedCount, 3);
  assert.equal(
    cumulative.items.reduce(
      (sum, item) => sum.plus(item.approvedUnitPrice.mul(item.quantity)),
      new Prisma.Decimal(0)
    ).toString(),
    '600'
  );
  await assert.rejects(
    () => resolveInvoiceSelection({
      request: {
        findUnique: async () => ({
          id: 'request-1',
          status: 'AWAITING_INVOICE',
          invoices: [{ id: 'invoice-existing' }]
        })
      },
      requestSelectionBatch: {
        findMany: async () => [
          {
            id: 'revision-1',
            revision: 1,
            status: 'APPROVED',
            invoice: null,
            items: [invoiceItem('item-1', 'source-a', 'APPROVED')]
          }
        ]
      }
    } as never, 'request-1'),
    (error) =>
      error instanceof InvoiceSelectionError
      && error.code === 'INVOICE_ALREADY_EXISTS_FOR_SELECTION'
  );

  assert.deepEqual(
    resolveRequestStatusTransition(
      'AWAITING_INVOICE',
      REQUEST_STATUS_EVENTS.FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL
    ),
    { outcome: 'noop', currentStatus: 'AWAITING_INVOICE', reason: 'idempotent_event' }
  );
  assert.deepEqual(
    resolveRequestStatusTransition(
      'WAITING_APPROVAL',
      REQUEST_STATUS_EVENTS.FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL
    ),
    { outcome: 'noop', currentStatus: 'WAITING_APPROVAL', reason: 'idempotent_event' }
  );

  const updateService = readFileSync('lib/request-items/update.ts', 'utf8');
  const deleteService = readFileSync('lib/request-items/delete.ts', 'utf8');
  const api = readFileSync('app/api/admin/request-items/[itemId]/route.ts', 'utf8');
  const actions = readFileSync('app/admin/actions.ts', 'utf8');
  const adminUi = readFileSync('app/admin/requests/[id]/page.tsx', 'utf8');
  const clientUi = readFileSync(
    'components/client/client-approval-batch-section.tsx',
    'utf8'
  );
  const changeApply = readFileSync('lib/change-requests/apply.ts', 'utf8');
  const sendService = readFileSync(
    'lib/request-selection/send-for-approval.ts',
    'utf8'
  );

  assert.match(updateService, /APPROVED_REQUEST_ITEM_LOCKED/);
  assert.match(deleteService, /APPROVED_REQUEST_ITEM_DELETE_BLOCKED/);
  assert.match(api, /approved_item_locked/);
  assert.match(api, /approved_item_delete_blocked/);
  assert.match(changeApply, /change-request-approved-item-locked/);
  assert.match(actions, /revalidatePath\(`\/admin\/requests\/\$\{result\.item\.requestId\}`\)/);
  assert.match(actions, /redirectBack\(result\.item\.requestId, 'item-updated'\)/);
  assert.match(adminUi, /Погоджено — заблоковано/);
  assert.match(adminUi, /Змінено після відхилення/);
  assert.match(clientUi, /Раніше погоджено:/);
  assert.match(sendService, /FOLLOW_UP_REJECTED/);
  assert.match(sendService, /FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL/);
  assert.match(sendService, /mode !== 'FOLLOW_UP_REJECTED'/);

  console.log(
    'Stage Request Status Automation 5A2 follow-up checks passed.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
