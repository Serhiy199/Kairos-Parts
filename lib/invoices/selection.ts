import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type InvoiceSelectionErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_AWAITING_INVOICE'
  | 'APPROVED_SELECTION_NOT_FOUND'
  | 'INVOICE_SELECTION_STALE'
  | 'NO_APPROVED_ITEMS'
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
  managerComment: true
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
    select: { id: true, status: true }
  });
  if (!request) throw selectionError('REQUEST_NOT_FOUND', requestId);
  if (request.status !== 'AWAITING_INVOICE') {
    throw selectionError('REQUEST_NOT_AWAITING_INVOICE', requestId);
  }

  const latestBatch = await database.requestSelectionBatch.findFirst({
    where: { requestId },
    orderBy: [{ revision: 'desc' }, { id: 'asc' }],
    select: selectionBatchSelect
  });
  if (!latestBatch) {
    throw selectionError('APPROVED_SELECTION_NOT_FOUND', requestId);
  }
  if (
    latestBatch.status !== 'APPROVED'
    && latestBatch.status !== 'PARTIALLY_APPROVED'
  ) {
    throw selectionError('INVOICE_SELECTION_STALE', requestId, latestBatch);
  }
  if (latestBatch.invoice) {
    throw selectionError(
      'INVOICE_ALREADY_EXISTS_FOR_SELECTION',
      requestId,
      latestBatch
    );
  }

  const pendingCount = latestBatch.items.filter(
    (item) => item.status === 'PENDING'
  ).length;
  const approvedItems = latestBatch.items.filter(
    (item) => item.status === 'APPROVED'
  );
  const rejectedCount = latestBatch.items.filter(
    (item) => item.status === 'REJECTED'
  ).length;
  const aggregateMatchesStatus =
    pendingCount === 0
    && (
      (
        latestBatch.status === 'APPROVED'
        && approvedItems.length === latestBatch.items.length
      )
      || (
        latestBatch.status === 'PARTIALLY_APPROVED'
        && approvedItems.length > 0
        && rejectedCount > 0
        && approvedItems.length + rejectedCount === latestBatch.items.length
      )
    );
  if (!aggregateMatchesStatus) {
    throw selectionError('INVOICE_SELECTION_STALE', requestId, latestBatch);
  }
  if (approvedItems.length === 0) {
    throw selectionError('NO_APPROVED_ITEMS', requestId, latestBatch);
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
    batchId: latestBatch.id,
    revision: latestBatch.revision,
    status: latestBatch.status,
    currency: approvedItems[0].currency,
    approvedCount: approvedItems.length,
    rejectedCount,
    items: approvedItems as ResolvedInvoiceSelection['items']
  };
}

export type RequestInvoiceEligibility =
  | {
      eligible: true;
      selectionBatchId: string;
      revision: number;
      approvedCount: number;
      rejectedCount: number;
      currency: string;
    }
  | {
      eligible: false;
      reason: InvoiceSelectionErrorCode;
    };

export async function getRequestInvoiceEligibility(
  requestId: string
): Promise<RequestInvoiceEligibility> {
  try {
    const selection = await resolveInvoiceSelection(prisma, requestId);
    return {
      eligible: true,
      selectionBatchId: selection.batchId,
      revision: selection.revision,
      approvedCount: selection.approvedCount,
      rejectedCount: selection.rejectedCount,
      currency: selection.currency
    };
  } catch (error) {
    if (error instanceof InvoiceSelectionError) {
      return { eligible: false, reason: error.code };
    }
    throw error;
  }
}
