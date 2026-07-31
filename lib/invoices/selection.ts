import type {
  Prisma,
  RequestSelectionBatchStatus,
  RequestStatus
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type InvoiceSelectionSourceMode =
  | 'SIMPLIFIED_FINAL_BATCH'
  | 'LEGACY_CUMULATIVE';

export type InvoiceSelectionErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_AWAITING_INVOICE'
  | 'ACTIVE_SELECTION_REVIEW'
  | 'NO_FINALIZED_APPROVED_BATCH'
  | 'NO_APPROVED_ITEMS'
  | 'PENDING_ITEMS_REMAIN'
  | 'APPROVED_ITEM_PRICE_MISSING'
  | 'APPROVED_ITEMS_CURRENCY_MISMATCH'
  | 'APPROVED_ITEMS_ALREADY_INVOICED'
  | 'INVOICE_ALREADY_EXISTS_FOR_SELECTION'
  | 'LEGACY_SELECTION_AMBIGUOUS';

export class InvoiceSelectionError extends Error {
  constructor(
    readonly code: InvoiceSelectionErrorCode,
    readonly context: {
      requestId: string;
      selectionBatchId?: string;
      selectionRevision?: number;
      sourceMode?: InvoiceSelectionSourceMode;
    }
  ) {
    super(`Invoice selection resolution failed: ${code}.`);
    this.name = 'InvoiceSelectionError';
  }
}

const selectionItemSelect = {
  id: true,
  sourceRequestItemId: true,
  position: true,
  status: true,
  itemName: true,
  brand: true,
  catalogNumber: true,
  analogNumber: true,
  quantity: true,
  unit: true,
  approvedUnitPrice: true,
  currency: true,
  managerComment: true,
  invoiceItem: { select: { id: true } }
} satisfies Prisma.RequestSelectionBatchItemSelect;

const selectionBatchSelect = {
  id: true,
  revision: true,
  status: true,
  items: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: selectionItemSelect
  },
  invoice: { select: { id: true } }
} satisfies Prisma.RequestSelectionBatchSelect;

type SelectionBatch = Prisma.RequestSelectionBatchGetPayload<{
  select: typeof selectionBatchSelect;
}>;

type SelectionItem = SelectionBatch['items'][number];

type SelectionDatabase = Pick<
  Prisma.TransactionClient,
  'request' | 'requestSelectionBatch'
>;

export type ResolvedCanonicalInvoiceBatch = {
  batch: SelectionBatch;
  approvedItems: SelectionItem[];
  rejectedCount: number;
  sourceMode: InvoiceSelectionSourceMode;
};

export type ResolvedInvoiceSelection = {
  batchId: string;
  revision: number;
  status: 'APPROVED' | 'PARTIALLY_APPROVED';
  sourceMode: InvoiceSelectionSourceMode;
  currency: string;
  approvedCount: number;
  rejectedCount: number;
  items: Array<
    SelectionItem & {
      status: 'APPROVED';
      approvedUnitPrice: Prisma.Decimal;
    }
  >;
};

export type InvoiceEligibilityDiagnostics = {
  requestStatus: RequestStatus | null;
  batchStatus: RequestSelectionBatchStatus | null;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  sourceMode: InvoiceSelectionSourceMode | null;
};

function selectionError(
  code: InvoiceSelectionErrorCode,
  requestId: string,
  batch?: Pick<SelectionBatch, 'id' | 'revision'>,
  sourceMode?: InvoiceSelectionSourceMode
) {
  return new InvoiceSelectionError(code, {
    requestId,
    selectionBatchId: batch?.id,
    selectionRevision: batch?.revision,
    sourceMode
  });
}

function sortSelectionItems(items: SelectionItem[]) {
  return [...items].sort((left, right) =>
    left.position - right.position || left.id.localeCompare(right.id)
  );
}

function resolveSimplifiedFinalBatch(
  requestId: string,
  batch: SelectionBatch
): ResolvedCanonicalInvoiceBatch {
  const sourceMode = 'SIMPLIFIED_FINAL_BATCH' as const;
  if (
    batch.status !== 'APPROVED'
    && batch.status !== 'PARTIALLY_APPROVED'
  ) {
    throw selectionError(
      batch.status === 'REJECTED'
        ? 'NO_APPROVED_ITEMS'
        : 'NO_FINALIZED_APPROVED_BATCH',
      requestId,
      batch,
      sourceMode
    );
  }
  if (batch.items.some((item) => item.status === 'PENDING')) {
    throw selectionError(
      'PENDING_ITEMS_REMAIN',
      requestId,
      batch,
      sourceMode
    );
  }

  const approvedItems = sortSelectionItems(
    batch.items.filter((item) => item.status === 'APPROVED')
  );
  if (approvedItems.length === 0) {
    throw selectionError('NO_APPROVED_ITEMS', requestId, batch, sourceMode);
  }

  return {
    batch,
    approvedItems,
    rejectedCount: batch.items.filter((item) => item.status === 'REJECTED').length,
    sourceMode
  };
}

function resolveLegacyCumulativeSelection(
  requestId: string,
  batches: SelectionBatch[]
): ResolvedCanonicalInvoiceBatch {
  const sourceMode = 'LEGACY_CUMULATIVE' as const;
  if (batches.some((batch) =>
    batch.items.some((item) => item.status === 'PENDING')
  )) {
    const latestBatch = batches.at(-1);
    throw selectionError(
      'PENDING_ITEMS_REMAIN',
      requestId,
      latestBatch,
      sourceMode
    );
  }

  const approvedByIdentity = new Map<string, SelectionItem>();
  for (const batch of batches) {
    for (const item of batch.items) {
      if (item.status !== 'APPROVED') continue;
      approvedByIdentity.set(
        item.sourceRequestItemId ?? `snapshot:${item.id}`,
        item
      );
    }
  }

  const approvedItems = sortSelectionItems([...approvedByIdentity.values()]);
  const sourceBatch = [...batches]
    .reverse()
    .find((batch) => batch.items.some((item) => item.status === 'APPROVED'));
  if (!sourceBatch || approvedItems.length === 0) {
    throw selectionError(
      'NO_APPROVED_ITEMS',
      requestId,
      batches.at(-1),
      sourceMode
    );
  }
  if (
    sourceBatch.status !== 'APPROVED'
    && sourceBatch.status !== 'PARTIALLY_APPROVED'
  ) {
    throw selectionError(
      'LEGACY_SELECTION_AMBIGUOUS',
      requestId,
      sourceBatch,
      sourceMode
    );
  }

  const latestBatch = batches.at(-1) ?? sourceBatch;
  return {
    batch: sourceBatch,
    approvedItems,
    rejectedCount: latestBatch.items.filter(
      (item) => item.status === 'REJECTED'
    ).length,
    sourceMode
  };
}

export async function resolveCanonicalInvoiceBatch(
  database: SelectionDatabase,
  requestId: string
): Promise<ResolvedCanonicalInvoiceBatch> {
  const activeBatches = await database.requestSelectionBatch.findMany({
    where: { requestId, status: 'SENT' },
    orderBy: [{ revision: 'desc' }, { id: 'asc' }],
    take: 2,
    select: selectionBatchSelect
  });
  if (activeBatches.length > 0) {
    throw selectionError(
      'ACTIVE_SELECTION_REVIEW',
      requestId,
      activeBatches[0]
    );
  }

  const finalizedBatches = await database.requestSelectionBatch.findMany({
    where: {
      requestId,
      status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] }
    },
    orderBy: [{ revision: 'asc' }, { id: 'asc' }],
    select: selectionBatchSelect
  });
  if (finalizedBatches.length === 0) {
    throw selectionError('NO_FINALIZED_APPROVED_BATCH', requestId);
  }
  if (finalizedBatches.length === 1) {
    return resolveSimplifiedFinalBatch(requestId, finalizedBatches[0]);
  }

  return resolveLegacyCumulativeSelection(requestId, finalizedBatches);
}

export async function resolveInvoiceSelection(
  database: SelectionDatabase,
  requestId: string
): Promise<ResolvedInvoiceSelection> {
  const request = await database.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      invoices: { take: 1, select: { id: true } }
    }
  });
  if (!request) throw selectionError('REQUEST_NOT_FOUND', requestId);

  const source = await resolveCanonicalInvoiceBatch(database, requestId);
  if (request.status !== 'AWAITING_INVOICE') {
    throw selectionError(
      'REQUEST_NOT_AWAITING_INVOICE',
      requestId,
      source.batch,
      source.sourceMode
    );
  }
  if (request.invoices.length > 0) {
    throw selectionError(
      'INVOICE_ALREADY_EXISTS_FOR_SELECTION',
      requestId,
      source.batch,
      source.sourceMode
    );
  }
  if (source.approvedItems.some((item) => item.invoiceItem !== null)) {
    throw selectionError(
      'APPROVED_ITEMS_ALREADY_INVOICED',
      requestId,
      source.batch,
      source.sourceMode
    );
  }
  if (source.approvedItems.some((item) => item.approvedUnitPrice === null)) {
    throw selectionError(
      'APPROVED_ITEM_PRICE_MISSING',
      requestId,
      source.batch,
      source.sourceMode
    );
  }

  const currencies = new Set(
    source.approvedItems.map((item) => item.currency)
  );
  if (currencies.size !== 1) {
    throw selectionError(
      'APPROVED_ITEMS_CURRENCY_MISMATCH',
      requestId,
      source.batch,
      source.sourceMode
    );
  }

  return {
    batchId: source.batch.id,
    revision: source.batch.revision,
    status: source.batch.status as 'APPROVED' | 'PARTIALLY_APPROVED',
    sourceMode: source.sourceMode,
    currency: source.approvedItems[0].currency,
    approvedCount: source.approvedItems.length,
    rejectedCount: source.rejectedCount,
    items: source.approvedItems as ResolvedInvoiceSelection['items']
  };
}

export type RequestInvoiceEligibility = InvoiceEligibilityDiagnostics & (
  | {
      eligible: true;
      selectionBatchId: string;
      revision: number;
      currency: string;
    }
  | {
      eligible: false;
      reason: InvoiceSelectionErrorCode;
      selectionBatchId?: string;
      revision?: number;
    }
);

function diagnosticsForBatches(
  requestStatus: RequestStatus | null,
  batches: SelectionBatch[]
): InvoiceEligibilityDiagnostics {
  const activeBatch = [...batches]
    .reverse()
    .find((batch) => batch.status === 'SENT');
  const finalizedBatches = batches.filter((batch) =>
    ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'].includes(batch.status)
  );
  const sourceMode =
    finalizedBatches.length === 0
      ? null
      : finalizedBatches.length === 1
        ? 'SIMPLIFIED_FINAL_BATCH' as const
        : 'LEGACY_CUMULATIVE' as const;
  const latestFinalized = finalizedBatches.at(-1);
  const displayBatch = activeBatch ?? latestFinalized;
  const approvedByIdentity = new Map<string, SelectionItem>();
  const diagnosticSources =
    sourceMode === 'LEGACY_CUMULATIVE'
      ? finalizedBatches
      : latestFinalized
        ? [latestFinalized]
        : [];

  for (const batch of diagnosticSources) {
    for (const item of batch.items) {
      if (item.status === 'APPROVED') {
        approvedByIdentity.set(
          item.sourceRequestItemId ?? `snapshot:${item.id}`,
          item
        );
      }
    }
  }

  return {
    requestStatus,
    batchStatus: displayBatch?.status ?? null,
    approvedCount: approvedByIdentity.size,
    rejectedCount:
      latestFinalized?.items.filter((item) => item.status === 'REJECTED').length
      ?? 0,
    pendingCount:
      displayBatch?.items.filter((item) => item.status === 'PENDING').length
      ?? 0,
    sourceMode
  };
}

export async function inspectRequestInvoiceEligibility(
  database: SelectionDatabase,
  requestId: string
): Promise<RequestInvoiceEligibility> {
  const [request, batches] = await Promise.all([
    database.request.findUnique({
      where: { id: requestId },
      select: { id: true, status: true }
    }),
    database.requestSelectionBatch.findMany({
      where: {
        requestId,
        status: {
          in: ['SENT', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']
        }
      },
      orderBy: [{ revision: 'asc' }, { id: 'asc' }],
      select: selectionBatchSelect
    })
  ]);
  const diagnostics = diagnosticsForBatches(
    request?.status ?? null,
    batches
  );

  try {
    const selection = await resolveInvoiceSelection(database, requestId);
    return {
      eligible: true,
      selectionBatchId: selection.batchId,
      revision: selection.revision,
      approvedCount: selection.approvedCount,
      rejectedCount: selection.rejectedCount,
      pendingCount: 0,
      requestStatus: diagnostics.requestStatus,
      batchStatus: diagnostics.batchStatus,
      sourceMode: selection.sourceMode,
      currency: selection.currency
    };
  } catch (error) {
    if (error instanceof InvoiceSelectionError) {
      return {
        eligible: false,
        reason: error.code,
        selectionBatchId: error.context.selectionBatchId,
        revision: error.context.selectionRevision,
        ...diagnostics,
        sourceMode: error.context.sourceMode ?? diagnostics.sourceMode
      };
    }
    throw error;
  }
}

export async function getRequestInvoiceEligibility(
  requestId: string
): Promise<RequestInvoiceEligibility> {
  return inspectRequestInvoiceEligibility(prisma, requestId);
}
