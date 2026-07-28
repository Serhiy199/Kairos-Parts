import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Prisma } from '@prisma/client';

import {
  deriveRequestSelectionResendEligibility
} from '../lib/request-selection/resend-eligibility';
import {
  buildRequestSelectionSnapshot,
  hashRequestSelectionApprovalContent
} from '../lib/request-selection/snapshot';

const firstVersion = new Date('2026-07-28T08:00:00.000Z');
const editedVersion = new Date('2026-07-28T09:00:00.000Z');

function currentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    requestId: 'request-1',
    createdAt: new Date('2026-07-28T07:00:00.000Z'),
    updatedAt: firstVersion,
    equipmentType: 'Трактор',
    name: 'Фільтр',
    brand: 'MANN',
    catalogNumber: 'A-100',
    analogNumber: 'B-200',
    quantity: 2,
    unit: 'шт',
    availability: 'В наявності',
    deliveryTime: '2 дні',
    salePrice: new Prisma.Decimal('1250.50'),
    currency: 'UAH',
    comment: 'Для погодження',
    vehicleId: 'vehicle-1',
    vehicle: {
      id: 'vehicle-1',
      name: 'Основний трактор',
      manufacturer: 'John Deere',
      model: '6155M',
      year: 2022,
      vinOrSerial: 'TEST-VIN-1'
    },
    ...overrides
  };
}

function activeItem(source = currentItem(), overrides: Record<string, unknown> = {}) {
  const snapshot = buildRequestSelectionSnapshot(source);
  return {
    id: `batch-${source.id}`,
    ...snapshot,
    ...overrides
  };
}

function eligibility(input: {
  status?: 'IN_PROGRESS' | 'OFFER_PREPARING' | 'WAITING_APPROVAL' | 'AWAITING_INVOICE' | 'COMPLETED' | 'CANCELLED';
  items?: ReturnType<typeof currentItem>[];
  activeItems?: ReturnType<typeof activeItem>[] | null;
}) {
  return deriveRequestSelectionResendEligibility({
    request: {
      id: 'request-1',
      status: input.status ?? 'WAITING_APPROVAL',
      items: input.items ?? [currentItem()]
    },
    activeBatch: input.activeItems === null
      ? null
      : {
          id: 'batch-1',
          revision: 1,
          items: input.activeItems ?? [activeItem()]
        }
  });
}

function assertSingleState(
  expected: 'NOT_SENT' | 'UNCHANGED' | 'CHANGED_AFTER_SEND' | 'NEW_AFTER_SEND',
  result: ReturnType<typeof eligibility>
) {
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].state, expected);
}

function main() {
  const noActive = eligibility({ activeItems: null });
  assertSingleState('NOT_SENT', noActive);
  assert.equal(noActive.canSend, true);

  const unchanged = eligibility({});
  assertSingleState('UNCHANGED', unchanged);
  assert.equal(unchanged.canSend, false);
  assert.equal(unchanged.reason, 'NOTHING_TO_SEND');

  const approvalCriticalEdits: Array<[string, Record<string, unknown>]> = [
    ['equipment type', { equipmentType: 'Комбайн' }],
    ['name', { name: 'Оливний фільтр' }],
    ['brand', { brand: 'Donaldson' }],
    ['catalog number', { catalogNumber: 'A-101' }],
    ['analog number', { analogNumber: 'B-201' }],
    ['quantity', { quantity: 3 }],
    ['unit', { unit: 'компл.' }],
    ['availability', { availability: 'Під замовлення' }],
    ['delivery time', { deliveryTime: '7 днів' }],
    ['approved unit price', { salePrice: new Prisma.Decimal('1300.00') }],
    ['currency', { currency: 'EUR' }],
    ['manager comment', { comment: 'Оновлений коментар' }],
    [
      'vehicle',
      {
        vehicleId: 'vehicle-2',
        vehicle: {
          id: 'vehicle-2',
          name: 'Резервний трактор',
          manufacturer: 'Case IH',
          model: 'Puma 150',
          year: 2023,
          vinOrSerial: 'TEST-VIN-2'
        }
      }
    ]
  ];

  for (const [label, edit] of approvalCriticalEdits) {
    const result = eligibility({
      items: [currentItem({ ...edit, updatedAt: editedVersion })]
    });
    assertSingleState('CHANGED_AFTER_SEND', result);
    assert.equal(result.canSend, true, `${label} must enable resend`);
  }

  const internalOnly = eligibility({
    items: [
      currentItem({
        updatedAt: editedVersion,
        supplierName: 'Internal Supplier B',
        purchasePrice: new Prisma.Decimal('900.00')
      })
    ]
  });
  assertSingleState('UNCHANGED', internalOnly);
  assert.equal(
    internalOnly.canSend,
    false,
    'updatedAt and internal-only fields must not decide approval dirtiness'
  );
  assert.notEqual(
    internalOnly.items[0].currentUpdatedAt,
    internalOnly.items[0].activeBatchSourceUpdatedAt
  );
  assert.equal(
    internalOnly.items[0].currentApprovalHash,
    internalOnly.items[0].activeApprovalHash
  );

  const newItem = currentItem({ id: 'item-2', createdAt: editedVersion, updatedAt: editedVersion });
  const withNewItem = eligibility({ items: [currentItem(), newItem] });
  assert.equal(withNewItem.items.find((item) => item.requestItemId === 'item-2')?.state, 'NEW_AFTER_SEND');
  assert.deepEqual(withNewItem.eligibleItemIds, ['item-1', 'item-2']);
  assert.equal(withNewItem.canSend, true);

  const removed = eligibility({ items: [newItem] });
  assert.equal(removed.removedBatchItemIds.length, 1);
  assert.equal(removed.canSend, true);
  assert.deepEqual(removed.eligibleItemIds, ['item-2']);

  const nullSource = eligibility({
    items: [newItem],
    activeItems: [activeItem(currentItem(), { sourceRequestItemId: null })]
  });
  assert.equal(nullSource.removedBatchItemIds.length, 1);
  assertSingleState('NEW_AFTER_SEND', nullSource);

  const noItemsAfterRemoval = eligibility({ items: [] });
  assert.equal(noItemsAfterRemoval.removedBatchItemIds.length, 1);
  assert.equal(noItemsAfterRemoval.canSend, false);

  for (const status of ['AWAITING_INVOICE', 'COMPLETED', 'CANCELLED'] as const) {
    const blocked = eligibility({
      status,
      items: [currentItem({ quantity: 3, updatedAt: editedVersion })]
    });
    assert.equal(blocked.canSend, false);
    assert.equal(blocked.reason, 'REQUEST_STATUS_BLOCKED');
  }

  for (const status of ['IN_PROGRESS', 'OFFER_PREPARING', 'WAITING_APPROVAL'] as const) {
    const allowed = eligibility({
      status,
      items: [currentItem({ quantity: 3, updatedAt: editedVersion })]
    });
    assert.equal(allowed.canSend, true);
  }

  const snapshot = buildRequestSelectionSnapshot(currentItem());
  assert.equal(
    hashRequestSelectionApprovalContent(snapshot),
    hashRequestSelectionApprovalContent(snapshot),
    'approval-content hashing must be deterministic'
  );

  const adminPage = readFileSync('app/admin/requests/[id]/page.tsx', 'utf8');
  const sendService = readFileSync('lib/request-selection/send-for-approval.ts', 'utf8');
  const clientReadModel = readFileSync('lib/request-selection/client-read-model.ts', 'utf8');
  assert.match(adminPage, /Змінено після надсилання/);
  assert.match(adminPage, /Усі актуальні позиції вже входять до останньої надісланої версії/);
  assert.match(adminPage, /disabled=\{!eligibility\.canSend\}/);
  assert.match(adminPage, /currentUpdatedAt/);
  assert.doesNotMatch(adminPage, /currentApprovalHash[\s\S]*value=/);
  assert.match(sendService, /getResendEligibility/);
  assert.match(sendService, /canonicalItemIds/);
  assert.doesNotMatch(sendService, /sourceItem\.visibleToClient\)\s*fail/);
  assert.doesNotMatch(
    clientReadModel,
    /transitionRequestSelectionBatchStatus|transitionRequestStatus|requestSelectionBatch(Item)?\.(update|updateMany)/
  );

  console.log('Stage 4C1 resend-after-edit checks passed.');
}

main();
