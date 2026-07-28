import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';

import { getAdminRequestFeedback } from '../lib/admin/request-feedback';
import {
  createUpdateRequestItemService,
  RequestItemUpdateError
} from '../lib/request-items/update';
import {
  parseRequestItemUpdateInput,
  type RequestItemUpdateValues
} from '../lib/request-items/validation';
import { deriveRequestSelectionResendEligibility } from '../lib/request-selection/resend-eligibility';
import {
  buildRequestSelectionSnapshot,
  type RequestSelectionSnapshotSource
} from '../lib/request-selection/snapshot';

const root = path.resolve(__dirname, '..');
let checks = 0;

function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks += 1;
}

const updateValues: RequestItemUpdateValues = {
  equipmentType: 'Трактор',
  name: 'Тестова позиція',
  brand: 'MAN',
  catalogNumber: 'TEST-4C3',
  quantity: 4,
  unit: 'шт',
  availability: 'В наявності',
  salePrice: '100.00',
  currency: 'UAH',
  comment: 'Stage 4C3'
};

function validFormData(quantity = '4') {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    equipmentType: 'Трактор',
    name: 'Тестова позиція',
    brand: 'MAN',
    catalogNumber: 'TEST-4C3',
    quantity,
    unit: 'шт',
    availability: 'В наявності',
    salePrice: '100,00',
    currency: 'UAH',
    comment: 'Stage 4C3'
  })) {
    formData.set(key, value);
  }
  return formData;
}

async function main() {
const parsedForm = parseRequestItemUpdateInput(validFormData());
check(parsedForm.ok && parsedForm.data.quantity === 4, 'FormData quantity=4 must parse to Int 4.');
check(parsedForm.ok && parsedForm.data.salePrice === '100.00', 'Localized price comma must normalize.');
check(!parseRequestItemUpdateInput(validFormData('')).ok, 'Empty quantity must be rejected.');
check(!parseRequestItemUpdateInput(validFormData('0')).ok, 'Zero quantity policy must be explicit: rejected.');
check(!parseRequestItemUpdateInput(validFormData('-1')).ok, 'Negative quantity must be rejected.');
check(!parseRequestItemUpdateInput(validFormData('4.0')).ok, 'Decimal string quantity must be rejected for Int DB type.');
check(!parseRequestItemUpdateInput(validFormData('NaN')).ok, 'NaN quantity must be rejected.');

const duplicateQuantity = validFormData();
duplicateQuantity.append('quantity', '5');
check(!parseRequestItemUpdateInput(duplicateQuantity).ok, 'Duplicate quantity fields must be rejected.');

const missingQuantity = validFormData();
missingQuantity.delete('quantity');
check(!parseRequestItemUpdateInput(missingQuantity).ok, 'Missing quantity must not produce success.');

type FakeItem = {
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
  availability: string | null;
  salePrice: Prisma.Decimal | null;
  currency: string;
  comment: string | null;
  visibleToClient: boolean;
  includeInInvoice: boolean;
  updatedAt: Date;
  request: { requestNumber: string; companyId: string | null };
};

type FakeState = {
  item: FakeItem | null;
  actorRole: 'ADMIN' | 'MANAGER' | 'CLIENT';
  actorStatus: 'ACTIVE' | 'INACTIVE';
  audits: Array<Record<string, unknown>>;
  transactionCount: number;
  updateCount: number;
  readAfterWriteCount: number;
  failAudit: boolean;
  returnMismatchedPersistedQuantity: boolean;
};

function initialItem(): FakeItem {
  return {
    id: 'item-4c3',
    requestId: 'request-4c3',
    vehicleId: null,
    equipmentType: 'Трактор',
    name: 'Тестова позиція',
    brand: 'MAN',
    catalogNumber: 'TEST-4C3',
    analogNumber: null,
    quantity: 2,
    unit: 'шт',
    availability: 'В наявності',
    salePrice: new Prisma.Decimal('100.00'),
    currency: 'UAH',
    comment: 'Stage 4C3',
    visibleToClient: true,
    includeInInvoice: false,
    updatedAt: new Date('2026-07-28T08:00:00.000Z'),
    request: { requestNumber: 'KP-TEST-4C3', companyId: 'company-test' }
  };
}

function cloneItem(item: FakeItem | null) {
  return item
    ? {
        ...item,
        salePrice: item.salePrice ? new Prisma.Decimal(item.salePrice.toString()) : null,
        updatedAt: new Date(item.updatedAt),
        request: { ...item.request }
      }
    : null;
}

function createFakeHarness(options?: Partial<FakeState>) {
  const state: FakeState = {
    item: initialItem(),
    actorRole: 'ADMIN',
    actorStatus: 'ACTIVE',
    audits: [],
    transactionCount: 0,
    updateCount: 0,
    readAfterWriteCount: 0,
    failAudit: false,
    returnMismatchedPersistedQuantity: false,
    ...options
  };

  const tx = {
    user: {
      findUnique: async () => ({
        role: state.actorRole,
        status: state.actorStatus
      })
    },
    requestItem: {
      findUnique: async () => {
        if (state.updateCount > 0) state.readAfterWriteCount += 1;
        const item = cloneItem(state.item);
        if (item && state.returnMismatchedPersistedQuantity && state.updateCount > 0) {
          item.quantity = 2;
        }
        return item;
      },
      updateMany: async ({ where, data }: {
        where: { id: string; requestId: string; updatedAt: Date };
        data: RequestItemUpdateValues;
      }) => {
        if (
          !state.item
          || state.item.id !== where.id
          || state.item.requestId !== where.requestId
          || state.item.updatedAt.getTime() !== where.updatedAt.getTime()
        ) {
          return { count: 0 };
        }
        state.updateCount += 1;
        state.item = {
          ...state.item,
          ...data,
          salePrice: data.salePrice === null ? null : new Prisma.Decimal(data.salePrice),
          updatedAt: new Date(state.item.updatedAt.getTime() + 1000)
        };
        return { count: 1 };
      }
    }
  };

  const database = {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      state.transactionCount += 1;
      const beforeItem = cloneItem(state.item);
      const beforeAudits = [...state.audits];
      const beforeUpdates = state.updateCount;
      try {
        return await callback(tx);
      } catch (error) {
        state.item = beforeItem;
        state.audits = beforeAudits;
        state.updateCount = beforeUpdates;
        throw error;
      }
    }
  };

  const writeAudit = async (_writer: unknown, input: Record<string, unknown>) => {
    if (state.failAudit) throw new Error('audit failed');
    state.audits.push(input);
    return { id: `audit-${state.audits.length}` };
  };

  const service = createUpdateRequestItemService(
    database as never,
    { writeAudit: writeAudit as never }
  );

  return { state, service };
}

function serviceInput(values = updateValues) {
  return {
    requestItemId: 'item-4c3',
    requestId: 'request-4c3',
    expectedUpdatedAt: '2026-07-28T08:00:00.000Z',
    actor: { id: 'admin-4c3' },
    values,
    requestContext: undefined
  };
}

const successHarness = createFakeHarness();
const successResult = await successHarness.service(serviceInput());
check(successResult.outcome === 'changed', 'Quantity 2 -> 4 must produce changed outcome.');
check(successResult.code === 'REQUEST_ITEM_UPDATED', 'Changed result must have a typed code.');
check(successResult.item.quantity === 4, 'Returned persisted row must contain quantity 4.');
check(successHarness.state.item?.quantity === 4, 'DB state must persist quantity 4.');
check(successHarness.state.updateCount === 1, 'Canonical service must perform one update.');
check(successHarness.state.readAfterWriteCount === 1, 'Canonical service must read after write.');
check(successHarness.state.transactionCount === 1, 'Update and audit must use one transaction.');
check(successHarness.state.audits.length === 1, 'Real edit must create one audit event.');
check(
  JSON.stringify(successHarness.state.audits[0]?.oldValue) === JSON.stringify({ quantity: 2 })
  && JSON.stringify(successHarness.state.audits[0]?.newValue) === JSON.stringify({ quantity: 4 }),
  'Audit must contain only allowlisted quantity 2 -> 4 diff.'
);

const noOpHarness = createFakeHarness({ item: { ...initialItem(), quantity: 4 } });
const noOpResult = await noOpHarness.service(serviceInput());
check(noOpResult.outcome === 'no_changes', 'Same values must return no_changes.');
check(noOpResult.code === 'REQUEST_ITEM_NO_CHANGES', 'No-op must have a typed code.');
check(noOpHarness.state.updateCount === 0, 'No-op must not touch updatedAt.');
check(noOpHarness.state.audits.length === 0, 'No-op must not create misleading audit.');

const staleHarness = createFakeHarness();
await assert.rejects(
  staleHarness.service({
    ...serviceInput(),
    expectedUpdatedAt: '2026-07-28T07:59:59.000Z'
  }),
  (error) => error instanceof RequestItemUpdateError
    && error.code === 'REQUEST_ITEM_VERSION_CONFLICT'
);
checks += 1;
check(staleHarness.state.updateCount === 0, 'Stale edit must not update the row.');

const wrongRequestHarness = createFakeHarness();
await assert.rejects(
  wrongRequestHarness.service({ ...serviceInput(), requestId: 'request-other' }),
  (error) => error instanceof RequestItemUpdateError
    && error.code === 'REQUEST_ITEM_NOT_IN_REQUEST'
);
checks += 1;

for (const actorRole of ['CLIENT'] as const) {
  const forbiddenHarness = createFakeHarness({ actorRole });
  await assert.rejects(
    forbiddenHarness.service(serviceInput()),
    (error) => error instanceof RequestItemUpdateError && error.code === 'ACTOR_NOT_ALLOWED'
  );
  checks += 1;
}

for (const actorRole of ['ADMIN', 'MANAGER'] as const) {
  const allowedHarness = createFakeHarness({ actorRole });
  const result = await allowedHarness.service(serviceInput());
  check(result.item.quantity === 4, `${actorRole} must be allowed to persist the edit.`);
}

const auditFailureHarness = createFakeHarness({ failAudit: true });
await assert.rejects(
  auditFailureHarness.service(serviceInput()),
  (error) => error instanceof RequestItemUpdateError
    && error.code === 'REQUEST_ITEM_UPDATE_FAILED'
);
checks += 1;
check(auditFailureHarness.state.item?.quantity === 2, 'Audit failure must roll back item update.');
check(auditFailureHarness.state.audits.length === 0, 'Audit failure must not leave audit data.');

const mismatchHarness = createFakeHarness({ returnMismatchedPersistedQuantity: true });
await assert.rejects(
  mismatchHarness.service(serviceInput()),
  (error) => error instanceof RequestItemUpdateError
    && error.code === 'REQUEST_ITEM_UPDATE_NOT_PERSISTED'
);
checks += 1;
check(mismatchHarness.state.item?.quantity === 2, 'Persisted mismatch must roll back the update.');

function snapshotSource(quantity: number, updatedAt: string): RequestSelectionSnapshotSource & {
  requestId: string;
  createdAt: Date;
} {
  return {
    id: 'item-4c3',
    requestId: 'request-4c3',
    createdAt: new Date('2026-07-28T07:00:00.000Z'),
    updatedAt: new Date(updatedAt),
    equipmentType: 'Трактор',
    name: 'Тестова позиція',
    brand: 'MAN',
    catalogNumber: 'TEST-4C3',
    analogNumber: null,
    quantity,
    unit: 'шт',
    availability: 'В наявності',
    deliveryTime: null,
    salePrice: new Prisma.Decimal('100.00'),
    currency: 'UAH',
    comment: 'Stage 4C3',
    vehicleId: null,
    vehicle: null
  };
}

const revisionOneSnapshot = buildRequestSelectionSnapshot(
  snapshotSource(2, '2026-07-28T08:00:00.000Z')
);
const activeBatchItem = {
  id: 'batch-item-r1',
  ...revisionOneSnapshot
};
const unchangedEligibility = deriveRequestSelectionResendEligibility({
  request: {
    id: 'request-4c3',
    status: 'WAITING_APPROVAL',
    items: [snapshotSource(2, '2026-07-28T08:00:00.000Z')]
  },
  activeBatch: {
    id: 'batch-r1',
    revision: 1,
    items: [activeBatchItem]
  }
});
check(unchangedEligibility.reason === 'NOTHING_TO_SEND', 'Before edit eligibility must be unchanged.');

const changedEligibility = deriveRequestSelectionResendEligibility({
  request: {
    id: 'request-4c3',
    status: 'WAITING_APPROVAL',
    items: [snapshotSource(4, '2026-07-28T08:00:01.000Z')]
  },
  activeBatch: {
    id: 'batch-r1',
    revision: 1,
    items: [activeBatchItem]
  }
});
check(
  changedEligibility.changedItemIds.includes('item-4c3')
  && changedEligibility.reason === 'HAS_CHANGED_ITEMS'
  && changedEligibility.canSend,
  'Persisted quantity 4 must produce CHANGED_AFTER_SEND and enable resend.'
);

const revisionTwoSnapshot = buildRequestSelectionSnapshot(
  snapshotSource(4, '2026-07-28T08:00:01.000Z')
);
check(revisionOneSnapshot.quantity === 2, 'Revision 1 snapshot must remain immutable at 2.');
check(revisionTwoSnapshot.quantity === 4, 'Revision 2 snapshot source must contain 4.');

const successFeedback = getAdminRequestFeedback('item-updated');
const noChangesFeedback = getAdminRequestFeedback('item-no-changes');
const validationFeedback = getAdminRequestFeedback('item-validation-error');
const staleFeedback = getAdminRequestFeedback('item-stale');
const failureFeedback = getAdminRequestFeedback('item-update-error');
check(successFeedback?.tone === 'success', 'Persisted edit must map to green success.');
check(noChangesFeedback?.tone === 'warning', 'No-op must map to warning, not success.');
check(validationFeedback?.tone === 'error', 'Validation failure must map to red error.');
check(staleFeedback?.tone === 'warning', 'Stale edit must map to controlled warning.');
check(failureFeedback?.tone === 'error', 'DB failure must map to red error.');

const pageSource = fs.readFileSync(
  path.join(root, 'app/admin/requests/[id]/page.tsx'),
  'utf8'
);
const actionSource = fs.readFileSync(path.join(root, 'app/admin/actions.ts'), 'utf8');
const apiSource = fs.readFileSync(
  path.join(root, 'app/api/admin/request-items/[itemId]/route.ts'),
  'utf8'
);

check(
  pageSource.includes('name="quantity"')
  && pageSource.includes('name="expectedUpdatedAt"'),
  'Edit form must submit quantity and expectedUpdatedAt.'
);
check(
  actionSource.includes('await updateRequestItem({')
  && !actionSource.slice(
    actionSource.indexOf('export async function updateAdminRequestItem'),
    actionSource.indexOf('export async function sendAdminRequestItemsForApproval')
  ).includes('prisma.requestItem.update'),
  'Server Action must delegate to canonical update service.'
);
check(
  apiSource.includes('await updateRequestItem({')
  && !apiSource.slice(
    apiSource.indexOf('export async function PATCH'),
    apiSource.indexOf('export async function DELETE')
  ).includes('prisma.requestItem.update'),
  'PATCH must delegate to the same canonical update service.'
);
check(
  actionSource.indexOf('await updateRequestItem({')
    < actionSource.indexOf("revalidatePath('/admin');", actionSource.indexOf('export async function updateAdminRequestItem')),
  'Server Action revalidation must happen after canonical commit.'
);
check(
  apiSource.includes("status: 'version_conflict'")
  && apiSource.includes("status: 'no_changes'")
  && apiSource.includes("status: 'updated'"),
  'PATCH must expose controlled stale/no-op/success semantics.'
);

console.log(`Stage Request Status Automation 4C3 checks passed: ${checks}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
