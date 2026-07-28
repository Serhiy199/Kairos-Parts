import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';

import {
  InvoiceSelectionError,
  resolveInvoiceSelection
} from '../lib/invoices/selection';
import { resolveRequestSelectionBatchTransition } from '../lib/request-selection/lifecycle';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const schema = read('prisma/schema.prisma');
const statusMigration = read(
  'prisma/migrations/20260728150000_add_partially_approved_selection_batch_status/migration.sql'
);
const provenanceMigration = read(
  'prisma/migrations/20260728151000_add_invoice_selection_provenance/migration.sql'
);
const decisionService = read('lib/request-selection/client-decision.ts');
const invoiceService = read('lib/invoices/service.ts');
const invoiceSelection = read('lib/invoices/selection.ts');
const adminUi = read('app/admin/requests/[id]/page.tsx');
const clientUi = read('components/client/client-approval-batch-section.tsx');

assert.deepEqual(
  resolveRequestSelectionBatchTransition('SENT', 'PARTIALLY_APPROVE'),
  { outcome: 'allowed', nextStatus: 'PARTIALLY_APPROVED' }
);
assert.equal(
  resolveRequestSelectionBatchTransition('PARTIALLY_APPROVED', 'APPROVE').outcome,
  'blocked'
);

for (const token of [
  'PARTIALLY_APPROVED',
  'REQUEST_SELECTION_BATCH_PARTIALLY_APPROVED',
  'selectionBatchId',
  'selectionBatchItemId'
]) {
  assert.ok(schema.includes(token), `Schema token is missing: ${token}`);
}
assert.match(
  statusMigration,
  /ALTER TYPE "RequestSelectionBatchStatus"[\s\S]*'PARTIALLY_APPROVED'/
);
assert.ok(!statusMigration.includes('DROP '));
assert.ok(provenanceMigration.includes('"selectionBatchId" TEXT'));
assert.ok(provenanceMigration.includes('"selectionBatchItemId" TEXT'));
assert.ok(provenanceMigration.includes('ON DELETE SET NULL'));
assert.ok(!provenanceMigration.includes('NOT NULL'));
assert.ok(!provenanceMigration.includes('TRUNCATE'));

for (const token of [
  "batchEvent === 'PARTIALLY_APPROVE'",
  "batchOutcome: 'unchanged' | 'approved' | 'partially_approved' | 'rejected'",
  'pendingCount > 0',
  'approvedCount > 0 && rejectedCount > 0',
  'totalCount: total',
  'partial'
]) {
  assert.ok(decisionService.includes(token), `Partial approval guard missing: ${token}`);
}
assert.ok(!decisionService.includes("if (itemStatus === 'REJECTED') {"));

for (const token of [
  'resolveInvoiceSelection(tx, requestId)',
  'selectionBatchId: selection.batchId',
  'selectionBatchItemId: item.id',
  'item.approvedUnitPrice',
  'currency: selection.currency',
  "isolationLevel: 'Serializable'",
  'PrismaClientKnownRequestError',
  "error.code === 'P2002'",
  "error.code === 'P2034'",
  'attempt === 0'
]) {
  assert.ok(invoiceService.includes(token), `Invoice provenance guard missing: ${token}`);
}
assert.ok(!invoiceService.includes('salePrice ?? new Prisma.Decimal(0)'));
assert.ok(!invoiceService.includes('approvedByClient: true'));
assert.ok(invoiceSelection.includes("request.status !== 'AWAITING_INVOICE'"));
assert.ok(invoiceSelection.includes("latestBatch.status !== 'APPROVED'"));
assert.ok(invoiceSelection.includes("latestBatch.status !== 'PARTIALLY_APPROVED'"));
assert.ok(adminUi.includes('getRequestInvoiceEligibility'));
assert.ok(adminUi.includes('eligibility.eligible'));
assert.ok(clientUi.includes("activeBatch.status === 'PARTIALLY_APPROVED'"));

type Item = {
  id: string;
  sourceRequestItemId: string;
  position: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  itemName: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  approvedUnitPrice: Prisma.Decimal | null;
  currency: string;
  managerComment: string | null;
};

function item(
  id: string,
  status: Item['status'],
  price: Prisma.Decimal | null = new Prisma.Decimal('100.00'),
  currency = 'UAH'
): Item {
  return {
    id,
    sourceRequestItemId: `request-${id}`,
    position: Number(id.replace(/\D/g, '')) || 1,
    status,
    itemName: `Позиція ${id}`,
    brand: null,
    catalogNumber: null,
    analogNumber: null,
    quantity: 1,
    unit: 'шт',
    approvedUnitPrice: price,
    currency,
    managerComment: null
  };
}

function database(input: {
  requestStatus?: string;
  batchStatus?: string;
  invoiceId?: string | null;
  items?: Item[];
}) {
  return {
    request: {
      findUnique: async () => ({
        id: 'request-1',
        status: input.requestStatus ?? 'AWAITING_INVOICE'
      })
    },
    requestSelectionBatch: {
      findFirst: async () => ({
        id: 'batch-1',
        revision: 7,
        status: input.batchStatus ?? 'PARTIALLY_APPROVED',
        invoice: input.invoiceId ? { id: input.invoiceId } : null,
        items: input.items ?? [
          item('1', 'APPROVED'),
          item('2', 'REJECTED')
        ]
      })
    }
  } as never;
}

async function expectCode(
  run: () => Promise<unknown>,
  code: InvoiceSelectionError['code']
) {
  await assert.rejects(
    run,
    (error) => error instanceof InvoiceSelectionError && error.code === code
  );
}

async function main() {
  const partial = await resolveInvoiceSelection(database({}), 'request-1');
  assert.equal(partial.status, 'PARTIALLY_APPROVED');
  assert.equal(partial.approvedCount, 1);
  assert.equal(partial.rejectedCount, 1);
  assert.deepEqual(partial.items.map((entry) => entry.id), ['1']);

  const approved = await resolveInvoiceSelection(
    database({
      batchStatus: 'APPROVED',
      items: [item('1', 'APPROVED'), item('2', 'APPROVED')]
    }),
    'request-1'
  );
  assert.equal(approved.approvedCount, 2);
  assert.equal(approved.rejectedCount, 0);

  await expectCode(
    () => resolveInvoiceSelection(
      database({ requestStatus: 'WAITING_APPROVAL', batchStatus: 'SENT' }),
      'request-1'
    ),
    'REQUEST_NOT_AWAITING_INVOICE'
  );
  await expectCode(
    () => resolveInvoiceSelection(
      database({ batchStatus: 'SENT', items: [item('1', 'PENDING')] }),
      'request-1'
    ),
    'INVOICE_SELECTION_STALE'
  );
  await expectCode(
    () => resolveInvoiceSelection(
      database({ items: [item('1', 'APPROVED', null), item('2', 'REJECTED')] }),
      'request-1'
    ),
    'APPROVED_ITEM_PRICE_MISSING'
  );
  await expectCode(
    () => resolveInvoiceSelection(
      database({
        batchStatus: 'APPROVED',
        items: [
          item('1', 'APPROVED', new Prisma.Decimal(10), 'UAH'),
          item('2', 'APPROVED', new Prisma.Decimal(20), 'EUR')
        ]
      }),
      'request-1'
    ),
    'APPROVED_ITEMS_CURRENCY_MISMATCH'
  );
  await expectCode(
    () => resolveInvoiceSelection(database({ invoiceId: 'invoice-1' }), 'request-1'),
    'INVOICE_ALREADY_EXISTS_FOR_SELECTION'
  );

  console.log(
    'Stage Request Status Automation 5A partial approval and invoice eligibility checks passed.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
