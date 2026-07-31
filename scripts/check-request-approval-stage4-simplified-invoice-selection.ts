import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Prisma } from '@prisma/client';

import {
  InvoiceSelectionError,
  inspectRequestInvoiceEligibility,
  resolveCanonicalInvoiceBatch,
  resolveInvoiceSelection
} from '../lib/invoices/selection';
import {
  createInvoiceSelectionTransactionWorkflow
} from '../lib/invoices/create-workflow';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const serviceSource = read('lib/invoices/service.ts');
const selectionSource = read('lib/invoices/selection.ts');
const adminSource = read('app/admin/requests/[id]/page.tsx');
const feedbackSource = read('lib/admin/request-feedback.ts');
const schemaSource = read('prisma/schema.prisma');

type ItemStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type BatchStatus =
  | 'SENT'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

type SelectionItem = {
  id: string;
  sourceRequestItemId: string | null;
  position: number;
  status: ItemStatus;
  itemName: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  approvedUnitPrice: Prisma.Decimal | null;
  currency: string;
  managerComment: string | null;
  invoiceItem: { id: string } | null;
};

type SelectionBatch = {
  id: string;
  revision: number;
  status: BatchStatus;
  invoice: { id: string } | null;
  items: SelectionItem[];
};

function item(
  id: string,
  status: ItemStatus,
  input: Partial<SelectionItem> = {}
): SelectionItem {
  return {
    id,
    sourceRequestItemId: `source-${id}`,
    position: Number(id.replace(/\D/g, '')) || 1,
    status,
    itemName: `Snapshot ${id}`,
    brand: null,
    catalogNumber: null,
    analogNumber: null,
    quantity: 1,
    unit: 'шт',
    approvedUnitPrice: new Prisma.Decimal('100.00'),
    currency: 'UAH',
    managerComment: null,
    invoiceItem: null,
    ...input
  };
}

function batch(
  id: string,
  revision: number,
  status: BatchStatus,
  items: SelectionItem[]
): SelectionBatch {
  return { id, revision, status, invoice: null, items };
}

function filterBatches(
  batches: SelectionBatch[],
  args: {
    where?: {
      status?: string | { in?: string[] };
    };
    take?: number;
  }
) {
  const status = args.where?.status;
  const filtered = batches
    .filter((entry) =>
      !status
      || (
        typeof status === 'string'
          ? entry.status === status
          : !status.in || status.in.includes(entry.status)
      )
    )
    .sort((left, right) => left.revision - right.revision || left.id.localeCompare(right.id));
  return args.take ? filtered.slice(0, args.take) : filtered;
}

function database(input: {
  requestStatus?: string;
  invoices?: Array<{ id: string; status?: string }>;
  batches: SelectionBatch[];
}) {
  return {
    request: {
      findUnique: async () => ({
        id: 'request-1',
        status: input.requestStatus ?? 'AWAITING_INVOICE',
        invoices: input.invoices ?? []
      })
    },
    requestSelectionBatch: {
      findMany: async (args: Parameters<typeof filterBatches>[1]) =>
        filterBatches(input.batches, args)
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

type TransactionState = {
  requestStatus: string;
  batches: SelectionBatch[];
  invoices: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
  invoiceCreateCount: number;
  failInvoiceCreate?: boolean;
  failAudit?: boolean;
};

type FakeInvoiceItem = {
  selectionBatchItemId: string;
  name: string;
  quantity: number;
  price: Prisma.Decimal;
};

type FakeInvoiceCreateData = {
  requestId: string;
  selectionBatchId: string;
  currency: string;
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  items: { create: FakeInvoiceItem[] };
};

function transaction(state: TransactionState) {
  const requestRecord = () => ({
    id: 'request-1',
    requestNumber: 'KP-1',
    status: state.requestStatus,
    companyId: 'company-1',
    company: {
      name: 'ТОВ Покупець',
      edrpou: null,
      phone: null,
      email: null,
      legalAddress: null,
      billingDetails: {
        legalName: 'ТОВ Покупець',
        edrpou: null,
        ipn: null,
        iban: null,
        bankName: null,
        legalAddress: null,
        contactPerson: null,
        phone: null,
        email: null,
        vatPayer: true
      }
    },
    client: null,
    invoices: state.invoices.map((invoice) => ({ id: invoice.id as string }))
  });

  return {
    request: {
      findUnique: async () => requestRecord()
    },
    requestSelectionBatch: {
      findMany: async (args: Parameters<typeof filterBatches>[1]) =>
        filterBatches(state.batches, args)
    },
    sellerBillingDetails: {
      findFirst: async () => ({
        legalName: 'ТОВ Продавець',
        edrpou: null,
        ipn: null,
        iban: null,
        bankName: null,
        mfo: null,
        phone: null,
        email: null,
        legalAddress: null
      })
    },
    invoice: {
      create: async ({ data }: { data: FakeInvoiceCreateData }) => {
        state.invoiceCreateCount += 1;
        if (state.failInvoiceCreate) throw new Error('INVOICE_ITEM_CREATE_FAILED');
        const created = {
          id: `invoice-${state.invoiceCreateCount}`,
          invoiceNumber: String(state.invoiceCreateCount),
          status: 'DRAFT',
          sentAt: null,
          paidAt: null,
          cancelledAt: null,
          ...data,
          items: data.items.create
        };
        state.invoices.push(created as unknown as Record<string, unknown>);
        return created;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const created = state.invoices.find((invoice) => invoice.id === where.id);
        if (!created) throw new Error('INVOICE_NOT_FOUND');
        const selectedBatch = state.batches.find(
          (entry) => entry.id === created.selectionBatchId
        );
        return {
          ...created,
          companyId: 'company-1',
          subtotal: created.subtotal,
          totalAmount: created.totalAmount,
          request: {
            requestNumber: 'KP-1',
            status: state.requestStatus
          },
          selectionBatch: { revision: selectedBatch?.revision ?? null },
          _count: {
            items: (created.items as unknown[]).length
          }
        };
      }
    },
    user: {
      findUnique: async () => ({
        id: 'manager-1',
        name: 'Менеджер',
        email: 'manager@example.com',
        role: 'MANAGER'
      })
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (state.failAudit) throw new Error('AUDIT_FAILED');
        state.audits.push(data);
        return { id: `audit-${state.audits.length}` };
      }
    }
  };
}

async function runAtomic<T>(
  state: TransactionState,
  callback: (tx: ReturnType<typeof transaction>) => Promise<T>
) {
  const invoiceCount = state.invoices.length;
  const auditCount = state.audits.length;
  const createCount = state.invoiceCreateCount;
  try {
    return await callback(transaction(state));
  } catch (error) {
    state.invoices.splice(invoiceCount);
    state.audits.splice(auditCount);
    state.invoiceCreateCount = createCount;
    throw error;
  }
}

const createInput = {
  requestId: 'request-1',
  createdById: 'manager-1',
  createdByRole: 'MANAGER' as const
};

const runInvoiceTransaction = createInvoiceSelectionTransactionWorkflow({
  resolveSelection: (tx: ReturnType<typeof transaction>, requestId: string) =>
    resolveInvoiceSelection(tx as never, requestId),
  persistInvoice: async (
    tx: ReturnType<typeof transaction>,
    input: typeof createInput,
    selection: Awaited<ReturnType<typeof resolveInvoiceSelection>>
  ) => {
    const created = await tx.invoice.create({
      data: {
        requestId: input.requestId,
        selectionBatchId: selection.batchId,
        currency: selection.currency,
        subtotal: selection.items.reduce(
          (total, entry) =>
            total.add(entry.approvedUnitPrice.mul(entry.quantity)),
          new Prisma.Decimal(0)
        ),
        totalAmount: selection.items.reduce(
          (total, entry) =>
            total.add(entry.approvedUnitPrice.mul(entry.quantity)),
          new Prisma.Decimal(0)
        ),
        items: {
          create: selection.items.map((entry) => ({
            selectionBatchItemId: entry.id,
            name: entry.itemName,
            quantity: entry.quantity,
            price: entry.approvedUnitPrice
          }))
        }
      }
    });
    await tx.auditLog.create({
      data: {
        metadata: {
          selectionBatchId: selection.batchId,
          selectionRevision: selection.revision,
          selectionSourceMode: selection.sourceMode,
          approvedItemCount: selection.approvedCount,
          currency: selection.currency,
          total: created.totalAmount.toString()
        }
      }
    });
    return created;
  }
});

async function main() {
  let checks = 0;
  const passed = (condition: unknown, message: string) => {
    assert.ok(condition, message);
    checks += 1;
  };

  const approvedBatch = batch('batch-2', 2, 'APPROVED', [
    item('item-2', 'APPROVED', { position: 2 }),
    item('item-1', 'APPROVED', { position: 1 })
  ]);
  const approved = await resolveInvoiceSelection(
    database({ batches: [approvedBatch] }),
    'request-1'
  );
  passed(approved.items.length === 2, 'APPROVED batch includes all approved items');
  passed(
    approved.sourceMode === 'SIMPLIFIED_FINAL_BATCH',
    'single finalized batch uses simplified mode'
  );
  passed(
    approved.items.map((entry) => entry.id).join(',') === 'item-1,item-2',
    'item order is deterministic'
  );

  const partial = await resolveInvoiceSelection(
    database({
      batches: [
        batch('batch-partial', 3, 'PARTIALLY_APPROVED', [
          item('approved', 'APPROVED', {
            itemName: 'Immutable approved snapshot'
          }),
          item('rejected', 'REJECTED', { approvedUnitPrice: null })
        ])
      ]
    }),
    'request-1'
  );
  passed(partial.items.length === 1, 'partial batch includes only approved items');
  passed(partial.items[0].id === 'approved', 'rejected item is excluded');
  passed(
    partial.items[0].itemName === 'Immutable approved snapshot',
    'immutable batch snapshot is the invoice source'
  );
  passed(
    partial.rejectedCount === 1,
    'rejected items remain diagnostics only'
  );
  passed(
    partial.items[0].approvedUnitPrice?.toString() === '100',
    'rejected item without price does not block'
  );

  await expectCode(
    () => resolveInvoiceSelection(
      database({
        batches: [
          batch('bad-final', 1, 'PARTIALLY_APPROVED', [
            item('pending', 'PENDING'),
            item('approved', 'APPROVED')
          ])
        ]
      }),
      'request-1'
    ),
    'PENDING_ITEMS_REMAIN'
  );
  checks += 1;

  const supersededIgnored = await resolveInvoiceSelection(
    database({
      batches: [
        batch('old', 1, 'SUPERSEDED', [
          item('old-approved', 'APPROVED', { approvedUnitPrice: null })
        ]),
        batch('current', 2, 'APPROVED', [item('current-approved', 'APPROVED')])
      ]
    }),
    'request-1'
  );
  passed(
    supersededIgnored.items.map((entry) => entry.id).join(',') === 'current-approved',
    'SUPERSEDED items are excluded'
  );

  const activeDb = database({
    batches: [
      approvedBatch,
      batch('active', 3, 'SENT', [item('pending', 'PENDING')])
    ]
  });
  await expectCode(
    () => resolveCanonicalInvoiceBatch(activeDb, 'request-1'),
    'ACTIVE_SELECTION_REVIEW'
  );
  checks += 1;
  await expectCode(
    () => resolveInvoiceSelection(activeDb, 'request-1'),
    'ACTIVE_SELECTION_REVIEW'
  );
  checks += 1;
  const activeEligibility = await inspectRequestInvoiceEligibility(
    activeDb,
    'request-1'
  );
  passed(
    !activeEligibility.eligible
    && activeEligibility.reason === 'ACTIVE_SELECTION_REVIEW',
    'active SENT has an explicit eligibility reason'
  );
  passed(
    activeEligibility.batchStatus === 'SENT'
    && activeEligibility.pendingCount === 1,
    'active review diagnostics use the SENT batch'
  );

  await expectCode(
    () => resolveInvoiceSelection(
      database({
        batches: [
          batch('missing-price', 1, 'APPROVED', [
            item('approved', 'APPROVED', { approvedUnitPrice: null })
          ])
        ]
      }),
      'request-1'
    ),
    'APPROVED_ITEM_PRICE_MISSING'
  );
  checks += 1;
  await expectCode(
    () => resolveInvoiceSelection(
      database({
        batches: [
          batch('mixed', 1, 'APPROVED', [
            item('uah', 'APPROVED'),
            item('eur', 'APPROVED', { currency: 'EUR' })
          ])
        ]
      }),
      'request-1'
    ),
    'APPROVED_ITEMS_CURRENCY_MISMATCH'
  );
  checks += 1;
  passed(partial.currency === 'UAH', 'single currency selection succeeds');

  for (const status of ['DRAFT', 'SENT', 'PAID', 'CANCELLED']) {
    await expectCode(
      () => resolveInvoiceSelection(
        database({
          invoices: [{ id: `invoice-${status}`, status }],
          batches: [approvedBatch]
        }),
        'request-1'
      ),
      'INVOICE_ALREADY_EXISTS_FOR_SELECTION'
    );
    checks += 1;
  }
  passed(
    !serviceSource.includes("status: { not: 'CANCELLED' }"),
    'cancelled invoice reissue was not enabled'
  );

  const legacy = await resolveInvoiceSelection(
    database({
      batches: [
        batch('legacy-1', 1, 'PARTIALLY_APPROVED', [
          item('legacy-a', 'APPROVED', { sourceRequestItemId: 'source-a' }),
          item('legacy-b-old', 'REJECTED', { sourceRequestItemId: 'source-b' })
        ]),
        batch('legacy-2', 2, 'APPROVED', [
          item('legacy-b-new', 'APPROVED', {
            sourceRequestItemId: 'source-b',
            approvedUnitPrice: new Prisma.Decimal('200')
          }),
          item('legacy-orphan', 'APPROVED', { sourceRequestItemId: null })
        ])
      ]
    }),
    'request-1'
  );
  passed(legacy.sourceMode === 'LEGACY_CUMULATIVE', 'multi-finalized data uses legacy mode');
  passed(legacy.items.length === 3, 'legacy cumulative approvals are not lost');
  passed(
    legacy.items.some((entry) => entry.id === 'legacy-b-new'),
    'newer legacy approved snapshot replaces identity'
  );
  passed(
    legacy.items.every((entry) => entry.id !== 'legacy-b-old'),
    'legacy rejected snapshot is not invoiced'
  );
  passed(
    selectionSource.includes('resolveLegacyCumulativeSelection'),
    'legacy resolver is explicit'
  );
  passed(
    selectionSource.includes('finalizedBatches.length === 1'),
    'simplified mode is selected only for one finalized batch'
  );
  passed(
    schemaSource.includes('selectionBatchId String?')
    && schemaSource.includes('selectionBatchItemId String?'),
    'nullable pre-batch invoice provenance remains compatible'
  );
  passed(
    serviceSource.includes("status: { in: ['SENT', 'PAID'] }")
    && serviceSource.includes("{ status: 'CANCELLED', sentAt: { not: null } }"),
    'existing legacy invoices remain readable'
  );

  const transactionState: TransactionState = {
    requestStatus: 'AWAITING_INVOICE',
    batches: [
      batch('canonical', 4, 'PARTIALLY_APPROVED', [
        item('approved-2', 'APPROVED', { position: 2 }),
        item('rejected-1', 'REJECTED'),
        item('approved-1', 'APPROVED', { position: 1 })
      ])
    ],
    invoices: [],
    audits: [],
    invoiceCreateCount: 0
  };
  const beforeBatch = JSON.stringify(transactionState.batches);
  const created = await runAtomic(
    transactionState,
    (tx) => runInvoiceTransaction(tx, createInput)
  );
  passed(created.selectionBatchId === 'canonical', 'Invoice.selectionBatchId uses canonical batch');
  passed(
    created.items.map((entry: { selectionBatchItemId: string }) =>
      entry.selectionBatchItemId
    ).join(',') === 'approved-1,approved-2',
    'InvoiceItems retain exact approved batch item provenance'
  );
  passed(created.items.length === 2, 'transaction excludes rejected items');
  passed(transactionState.audits.length === 1, 'invoice creation writes one audit');
  const auditMetadata = transactionState.audits[0].metadata as Record<string, unknown>;
  passed(
    auditMetadata.selectionSourceMode === 'SIMPLIFIED_FINAL_BATCH'
    && auditMetadata.approvedItemCount === 2
    && auditMetadata.selectionBatchId === 'canonical',
    'audit includes source mode, batch and approved count'
  );
  passed(
    auditMetadata.currency === 'UAH' && auditMetadata.total === '200',
    'audit includes currency and total without full snapshots'
  );
  passed(
    JSON.stringify(transactionState.batches) === beforeBatch,
    'invoice creation does not mutate selection batches'
  );
  passed(
    transactionState.requestStatus === 'AWAITING_INVOICE',
    'invoice creation does not transition Request'
  );

  await expectCode(
    () => runAtomic(
      transactionState,
      (tx) => runInvoiceTransaction(tx, createInput)
    ),
    'INVOICE_ALREADY_EXISTS_FOR_SELECTION'
  );
  checks += 1;
  passed(transactionState.invoices.length === 1, 'duplicate create leaves one invoice');

  const raceState: TransactionState = {
    requestStatus: 'AWAITING_INVOICE',
    batches: [
      approvedBatch,
      batch('new-active', 3, 'SENT', [item('pending', 'PENDING')])
    ],
    invoices: [],
    audits: [],
    invoiceCreateCount: 0
  };
  await expectCode(
    () => runAtomic(
      raceState,
      (tx) => runInvoiceTransaction(tx, createInput)
    ),
    'ACTIVE_SELECTION_REVIEW'
  );
  checks += 1;
  passed(raceState.invoiceCreateCount === 0, 'transactional reread blocks active review before create');

  const invoiceFailure: TransactionState = {
    requestStatus: 'AWAITING_INVOICE',
    batches: [approvedBatch],
    invoices: [],
    audits: [],
    invoiceCreateCount: 0,
    failInvoiceCreate: true
  };
  await assert.rejects(
    () => runAtomic(
      invoiceFailure,
      (tx) => runInvoiceTransaction(tx, createInput)
    ),
    /INVOICE_ITEM_CREATE_FAILED/
  );
  checks += 1;
  passed(
    invoiceFailure.invoices.length === 0 && invoiceFailure.audits.length === 0,
    'InvoiceItem/create failure rolls back'
  );

  const auditFailure: TransactionState = {
    requestStatus: 'AWAITING_INVOICE',
    batches: [approvedBatch],
    invoices: [],
    audits: [],
    invoiceCreateCount: 0,
    failAudit: true
  };
  await assert.rejects(
    () => runAtomic(
      auditFailure,
      (tx) => runInvoiceTransaction(tx, createInput)
    ),
    /AUDIT_FAILED/
  );
  checks += 1;
  passed(
    auditFailure.invoices.length === 0 && auditFailure.audits.length === 0,
    'audit failure rolls back invoice creation'
  );

  passed(
    serviceSource.includes("isolationLevel: 'Serializable'")
    && serviceSource.includes("error.code === 'P2034'"),
    'production uses Serializable transaction with conflict retry'
  );
  passed(
    serviceSource.includes('createInvoiceFromApprovedSelectionTransaction(tx'),
    'selection is reread inside the production transaction'
  );
  passed(
    adminSource.includes(
      'Клієнт ще не завершив погодження актуального підбору.'
    ),
    'CRM shows active review blocker'
  );
  passed(
    adminSource.includes(
      'У погодженому підборі немає позицій для формування рахунку.'
    ),
    'CRM shows zero-approved blocker'
  );
  passed(
    adminSource.includes(
      'Заявка містить історичний багатоверсійний підбір.'
    ),
    'CRM has controlled legacy ambiguity text'
  );
  passed(
    !adminSource.includes('{eligibility.reason}'),
    'CRM does not render technical reason directly'
  );
  passed(
    adminSource.includes('invoices.map((invoice)')
    && adminSource.includes('InvoiceStatusBadge'),
    'existing invoice UI remains present'
  );
  passed(
    feedbackSource.includes('invoice-selection-active-review')
    && feedbackSource.includes('invoice-selection-legacy-ambiguous'),
    'Server Action feedback maps controlled blockers'
  );
  passed(
    serviceSource.includes('selectionBatchItemId: item.id')
    && !serviceSource.includes('approvedByClient: true'),
    'live RequestItem approval flags are not invoice source'
  );

  assert.ok(checks >= 44, `Expected at least 44 checks, received ${checks}.`);
  console.log(
    `Stage Request Approval 4 simplified invoice selection checks passed (${checks} checks).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
