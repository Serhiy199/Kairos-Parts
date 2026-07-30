import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ClientRequestApprovalReadError,
  createClientRequestApprovalReadService
} from '../lib/request-selection/client-read-model';
import {
  formatClientSelectionPrice,
  formatClientSelectionQuantity
} from '../lib/request-selection/client-presentation';

type State = {
  actor: Record<string, unknown> | null;
  request: Record<string, unknown> | null;
  batches: Array<Record<string, unknown>>;
  legacyItems: Array<Record<string, unknown>>;
  failures?: {
    identity?: boolean;
    batch?: boolean;
    legacy?: boolean;
  };
  calls: {
    batchWhere?: Record<string, unknown>;
    legacy: number;
  };
};

const decimal = (value: string) => ({ toString: () => value });

function baseState(): State {
  return {
    actor: {
      id: 'client-user-1',
      role: 'CLIENT',
      status: 'ACTIVE',
      clientProfile: { id: 'client-profile-1' },
      companyMemberships: [{ companyId: 'company-1' }]
    },
    request: {
      id: 'request-1',
      requestNumber: 'KP-1001',
      status: 'WAITING_APPROVAL',
      clientId: 'client-profile-1',
      companyId: 'company-1'
    },
    batches: [
      {
        id: 'batch-2',
        revision: 2,
        status: 'SENT',
        sentAt: new Date('2026-07-27T10:30:00.000Z'),
        items: [
          {
            id: 'snapshot-2',
            position: 2,
            status: 'APPROVED',
            equipmentType: 'Трактор',
            itemName: 'Фільтр',
            brand: 'Fleetguard',
            catalogNumber: 'FF-2',
            analogNumber: 'AF-2',
            quantity: decimal('2.500'),
            unit: ' шт ',
            availability: 'В наявності',
            deliveryTime: '2 дні',
            approvedUnitPrice: decimal('1234.50'),
            currency: 'UAH',
            managerComment: 'Snapshot comment',
            vehicleDisplayName: 'John Deere 6155M',
            vehicleBrand: 'John Deere',
            vehicleModel: '6155M',
            vehicleYear: 2022,
            sourceRequestItemId: 'must-not-leak',
            snapshotHash: 'must-not-leak',
            vehicleVin: 'must-not-leak',
            purchasePrice: decimal('900'),
            supplierName: 'must-not-leak'
          },
          {
            id: 'snapshot-1',
            position: 1,
            status: 'PENDING',
            equipmentType: null,
            itemName: 'Підшипник',
            brand: null,
            catalogNumber: null,
            analogNumber: null,
            quantity: decimal('1'),
            unit: '',
            availability: null,
            deliveryTime: null,
            approvedUnitPrice: null,
            currency: 'USD',
            managerComment: null,
            vehicleDisplayName: null,
            vehicleBrand: null,
            vehicleModel: null,
            vehicleYear: null
          }
        ]
      }
    ],
    legacyItems: [
      {
        id: 'live-item-1',
        equipmentType: 'Комбайн',
        name: 'Live item',
        brand: 'Live brand',
        catalogNumber: 'LIVE-1',
        analogNumber: null,
        quantity: 3,
        unit: 'шт',
        availability: 'live',
        deliveryTime: 'live',
        salePrice: decimal('999.00'),
        currency: 'UAH',
        comment: 'live',
        approvedByClient: false,
        includeInInvoice: false
      }
    ],
    calls: { legacy: 0 }
  };
}

function makeDatabase(state: State) {
  return {
    user: {
      findUnique: async () => {
        if (state.failures?.identity) throw new Error('identity read failed');
        return state.actor;
      }
    },
    request: {
      findUnique: async () => {
        if (state.failures?.identity) throw new Error('request read failed');
        return state.request;
      }
    },
    requestSelectionBatch: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (state.failures?.batch) throw new Error('batch read failed');
        state.calls.batchWhere = where;
        return state.batches
          .filter((batch) => batch.status === where.status)
          .map((batch) => ({
            ...batch,
            items: [...(batch.items as Array<Record<string, unknown>>)]
              .sort((left, right) =>
                Number(left.position) - Number(right.position)
                || String(left.id).localeCompare(String(right.id)))
          }))
          .slice(0, 2);
      }
    },
    requestSelectionBatchItem: {
      findMany: async () => []
    },
    requestItem: {
      findMany: async () => {
        state.calls.legacy += 1;
        if (state.failures?.legacy) throw new Error('legacy read failed');
        return state.legacyItems;
      }
    }
  };
}

async function read(state: State) {
  const service = createClientRequestApprovalReadService(makeDatabase(state) as never);
  return service({ requestId: 'request-1', actorUserId: 'client-user-1' });
}

async function expectError(state: State, code: string) {
  await assert.rejects(
    () => read(state),
    (error) => error instanceof ClientRequestApprovalReadError && error.code === code
  );
}

const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push([name, run]);

test('active SENT batch selects BATCH mode', async () => {
  assert.equal((await read(baseState())).mode, 'BATCH');
});

test('batch query is constrained to status SENT', async () => {
  const state = baseState();
  await read(state);
  assert.deepEqual(state.calls.batchWhere, { requestId: 'request-1', status: 'SENT' });
});

test('DRAFT and SUPERSEDED batches are ignored', async () => {
  const state = baseState();
  state.batches = [
    { ...state.batches[0], id: 'draft', status: 'DRAFT' },
    { ...state.batches[0], id: 'old', status: 'SUPERSEDED' }
  ];
  const result = await read(state);
  assert.equal(result.mode, 'LEGACY');
});

test('multiple SENT batches fail with typed integrity error', async () => {
  const state = baseState();
  state.batches.push({ ...state.batches[0], id: 'batch-duplicate' });
  await expectError(state, 'ACTIVE_BATCH_INTEGRITY_ERROR');
});

test('batch items are deterministically ordered by position', async () => {
  const result = await read(baseState());
  assert.equal(result.mode, 'BATCH');
  assert.deepEqual(result.activeBatch.items.map((item) => item.position), [1, 2]);
});

test('batch DTO includes immutable snapshot values', async () => {
  const result = await read(baseState());
  assert.equal(result.mode, 'BATCH');
  assert.equal(result.activeBatch.items[1].itemName, 'Фільтр');
  assert.equal(result.activeBatch.items[1].managerComment, 'Snapshot comment');
  assert.equal(result.activeBatch.items[1].unitPrice, '1234.50');
});

test('internal linkage, hash, VIN, purchase and supplier fields never leak', async () => {
  const payload = JSON.stringify(await read(baseState()));
  for (const forbidden of [
    'sourceRequestItemId',
    'snapshotHash',
    'vehicleVin',
    'purchasePrice',
    'supplierName',
    'must-not-leak'
  ]) {
    assert.equal(payload.includes(forbidden), false, forbidden);
  }
});

test('null approved price does not expose a currency', async () => {
  const result = await read(baseState());
  assert.equal(result.mode, 'BATCH');
  assert.equal(result.activeBatch.items[0].unitPrice, null);
  assert.equal(result.activeBatch.items[0].currency, null);
});

test('batch mode never queries mutable legacy items', async () => {
  const state = baseState();
  await read(state);
  assert.equal(state.calls.legacy, 0);
});

test('live RequestItem mutations cannot change a batch DTO', async () => {
  const state = baseState();
  const before = await read(state);
  state.legacyItems[0].name = 'mutated live value';
  state.legacyItems[0].salePrice = decimal('1.00');
  const after = await read(state);
  assert.deepEqual(after, before);
});

test('deleted source RequestItem does not affect detached snapshot', async () => {
  const state = baseState();
  state.legacyItems = [];
  const result = await read(state);
  assert.equal(result.mode, 'BATCH');
  assert.equal(result.activeBatch.items.length, 2);
});

test('legacy mode is used only when no SENT batch exists', async () => {
  const state = baseState();
  state.batches = [];
  const result = await read(state);
  assert.equal(result.mode, 'LEGACY');
  assert.equal(result.legacyItems[0].name, 'Live item');
});

test('empty mode is normal when batch and legacy rows are absent', async () => {
  const state = baseState();
  state.batches = [];
  state.legacyItems = [];
  assert.equal((await read(state)).mode, 'EMPTY');
});

test('company request requires matching company membership', async () => {
  const state = baseState();
  state.actor!.companyMemberships = [{ companyId: 'other-company' }];
  await expectError(state, 'REQUEST_ACCESS_DENIED');
});

test('personal request requires matching ClientProfile', async () => {
  const state = baseState();
  state.request!.companyId = null;
  state.request!.clientId = 'other-profile';
  await expectError(state, 'REQUEST_ACCESS_DENIED');
});

test('matching personal request remains accessible', async () => {
  const state = baseState();
  state.request!.companyId = null;
  assert.equal((await read(state)).mode, 'BATCH');
});

test('missing request is typed', async () => {
  const state = baseState();
  state.request = null;
  await expectError(state, 'REQUEST_NOT_FOUND');
});

test('missing, inactive, and non-client actors are rejected', async () => {
  const missing = baseState();
  missing.actor = null;
  await expectError(missing, 'ACTOR_NOT_FOUND');
  const inactive = baseState();
  inactive.actor!.status = 'DISABLED';
  await expectError(inactive, 'ACTOR_NOT_ALLOWED');
  const staff = baseState();
  staff.actor!.role = 'MANAGER';
  await expectError(staff, 'ACTOR_NOT_ALLOWED');
});

test('read failures are converted to stable error codes', async () => {
  const identity = baseState();
  identity.failures = { identity: true };
  await expectError(identity, 'BATCH_READ_FAILED');
  const batch = baseState();
  batch.failures = { batch: true };
  await expectError(batch, 'BATCH_READ_FAILED');
  const legacy = baseState();
  legacy.batches = [];
  legacy.failures = { legacy: true };
  await expectError(legacy, 'LEGACY_READ_FAILED');
});

test('price and quantity presentation handles null and decimal strings', () => {
  assert.equal(formatClientSelectionPrice(null, null), 'Ціна уточнюється');
  assert.equal(formatClientSelectionPrice('1234.50', 'UAH'), '1 234,50 UAH');
  assert.equal(formatClientSelectionQuantity('2.500', 'шт'), '2.500 шт');
});

test('batch UI remains snapshot-based and legacy action stays isolated', () => {
  const batch = readFileSync('components/client/client-approval-batch-section.tsx', 'utf8');
  const legacy = readFileSync('components/client/client-legacy-selection-section.tsx', 'utf8');
  assert.doesNotMatch(batch, /approveClientRequestItemsAction|approvedByClient|includeInInvoice/);
  assert.doesNotMatch(batch, /<form|type="checkbox"|sourceRequestItemId|snapshotHash|vehicleVin/);
  assert.match(batch, /ClientSelectionCheckboxList/);
  assert.match(batch, /submitAction=\{submitClientSelectionAction\}/);
  assert.match(legacy, /approveClientRequestItemsAction/);
});

test('page explicitly renders BATCH, LEGACY, and EMPTY states', () => {
  const page = readFileSync('app/client/requests/[id]/page.tsx', 'utf8');
  assert.match(page, /mode === 'BATCH'/);
  assert.match(page, /mode === 'LEGACY'/);
  assert.match(page, /Підібраних позицій для цієї заявки поки немає/);
  assert.doesNotMatch(page, /approveClientRequestItemsAction|request\.items/);
});

test('existing invoice, document, and file surfaces remain present', () => {
  const page = readFileSync('app/client/requests/[id]/page.tsx', 'utf8');
  assert.match(page, /request\.invoices/);
  assert.match(page, /request\.requestDocuments/);
  assert.match(page, /request\.files/);
});

test('client-safe Prisma select excludes forbidden snapshot fields', () => {
  const source = readFileSync('lib/request-selection/client-read-model.ts', 'utf8');
  const select = source.slice(
    source.indexOf('const batchItemSelect'),
    source.indexOf('const activeBatchSelect')
  );
  assert.doesNotMatch(
    select,
    /sourceRequestItemId|snapshotHash|vehicleVin|purchasePrice|supplierName/
  );
});

async function main() {
  let passed = 0;
  for (const [name, run] of tests) {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`Stage 4D read-model checks passed: ${passed}/${tests.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
