import type {
  Prisma,
  RequestSelectionBatchStatus,
  RequestStatus
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type InvoiceSelectionErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_AWAITING_INVOICE'
  | 'NO_FINALIZED_APPROVED_BATCH'
  | 'NO_APPROVED_ITEMS'
  | 'PENDING_ITEMS_REMAIN'
  | 'APPROVED_ITEM_PRICE_MISSING'
  | 'APPROVED_ITEMS_CURRENCY_MISMATCH'
  | 'INVOICE_ALREADY_EXISTS_FOR_SELECTION';

export class InvoiceSelectionError extends Error {
  constructor(
    readonly code: InvoiceSelectionErrorCode,
    readonly context: {
      requestId: string;
      selectionBatchId?: string;
      selectionRevision?: number;
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

type SelectionDatabase = Pick<
  Prisma.TransactionClient,
  'request' | 'requestSelectionBatch'
>;

export type ResolvedInvoiceSelection = {
  batchId: string;
  revision: number;
  status: 'APPROVED' | 'PARTIALLY_APPROVED';
  currency: string;
  approvedCount: number;
  rejectedCount: number;
  items: Array<
    SelectionBatch['items'][number] & {
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
};

function selectionError(
  code: InvoiceSelectionErrorCode,
  requestId: string,
  batch?: Pick<SelectionBatch, 'id' | 'revision'>
) {
  return new InvoiceSelectionError(code, {
    requestId,
    selectionBatchId: batch?.id,
    selectionRevision: batch?.revision
  });
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
  const finalizedBatches = await database.requestSelectionBatch.findMany({
    where: {
      requestId,
      status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] }
    },
    orderBy: [{ revision: 'asc' }, { id: 'asc' }],
    select: selectionBatchSelect
  });
  const latestBatch = finalizedBatches.at(-1);
  if (!latestBatch) {
    throw selectionError('NO_FINALIZED_APPROVED_BATCH', requestId);
  }
  const approvedByIdentity = new Map<string, SelectionBatch['items'][number]>();
  for (const batch of finalizedBatches) {
    for (const item of batch.items) {
      if (item.status !== 'APPROVED') continue;
      approvedByIdentity.set(
        item.sourceRequestItemId ?? `snapshot:${item.id}`,
        item
      );
    }
  }
  const approvedItems = [...approvedByIdentity.values()]
    .filter((item) => item.invoiceItem === null)
    .sort((left, right) =>
      left.position - right.position || left.id.localeCompare(right.id)
    );
  const latestApprovedBatch = [...finalizedBatches]
    .reverse()
    .find((batch) => batch.items.some((item) => item.status === 'APPROVED'))
    ?? latestBatch;
  if (approvedItems.length === 0) {
    throw selectionError('NO_APPROVED_ITEMS', requestId, latestBatch);
  }
  if (
    latestApprovedBatch.status !== 'APPROVED'
    && latestApprovedBatch.status !== 'PARTIALLY_APPROVED'
  ) {
    throw selectionError(
      'NO_FINALIZED_APPROVED_BATCH',
      requestId,
      latestApprovedBatch
    );
  }
  const rejectedCount = latestBatch.items.filter(
    (item) => item.status === 'REJECTED'
  ).length;

  if (request.status !== 'AWAITING_INVOICE') {
    throw selectionError('REQUEST_NOT_AWAITING_INVOICE', requestId, latestBatch);
  }
  if (request.invoices.length > 0) {
    throw selectionError(
      'INVOICE_ALREADY_EXISTS_FOR_SELECTION',
      requestId,
      latestBatch
    );
  }

  if (approvedItems.some((item) => item.approvedUnitPrice === null)) {
    throw selectionError(
      'APPROVED_ITEM_PRICE_MISSING',
      requestId,
      latestBatch
    );
  }

  const currencies = new Set(approvedItems.map((item) => item.currency));
  if (currencies.size !== 1) {
    throw selectionError(
      'APPROVED_ITEMS_CURRENCY_MISMATCH',
      requestId,
      latestBatch
    );
  }

  return {
    batchId: latestApprovedBatch.id,
    revision: latestApprovedBatch.revision,
    status: latestApprovedBatch.status,
    currency: approvedItems[0].currency,
    approvedCount: approvedItems.length,
    rejectedCount,
    items: approvedItems as ResolvedInvoiceSelection['items']
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

export async function inspectRequestInvoiceEligibility(
  database: SelectionDatabase,
  requestId: string
): Promise<RequestInvoiceEligibility> {
  const [request, finalizedBatches] = await Promise.all([
    database.request.findUnique({
      where: { id: requestId },
      select: { id: true, status: true }
    }),
    database.requestSelectionBatch.findMany({
      where: {
        requestId,
        status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] }
      },
      orderBy: [{ revision: 'asc' }, { id: 'asc' }],
      select: selectionBatchSelect
    })
  ]);
  const latestBatch = finalizedBatches.at(-1);
  const cumulativeApproved = new Map<string, SelectionBatch['items'][number]>();
  for (const batch of finalizedBatches) {
    for (const item of batch.items) {
      if (item.status === 'APPROVED') {
        cumulativeApproved.set(
          item.sourceRequestItemId ?? `snapshot:${item.id}`,
          item
        );
      }
    }
  }
  const diagnostics: InvoiceEligibilityDiagnostics = {
    requestStatus: request?.status ?? null,
    batchStatus: latestBatch?.status ?? null,
    approvedCount: cumulativeApproved.size,
    rejectedCount:
      latestBatch?.items.filter((item) => item.status === 'REJECTED').length ?? 0,
    pendingCount:
      latestBatch?.items.filter((item) => item.status === 'PENDING').length ?? 0
  };

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
      currency: selection.currency
    };
  } catch (error) {
    if (error instanceof InvoiceSelectionError) {
      return {
        eligible: false,
        reason: error.code,
        selectionBatchId: error.context.selectionBatchId,
        revision: error.context.selectionRevision,
        ...diagnostics
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
