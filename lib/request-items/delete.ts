import type { Prisma } from '@prisma/client';

export class RequestItemDeleteError extends Error {
  constructor(
    readonly code:
      | 'REQUEST_ITEM_NOT_FOUND'
      | 'APPROVED_REQUEST_ITEM_DELETE_BLOCKED',
    readonly context: { requestItemId: string; requestId: string }
  ) {
    super(`Request item delete failed: ${code}.`);
    this.name = 'RequestItemDeleteError';
  }
}

export async function assertRequestItemDeleteAllowed(
  tx: Prisma.TransactionClient,
  input: { requestItemId: string; requestId: string }
) {
  const [item, approvedSnapshot, invoiceItem] = await Promise.all([
    tx.requestItem.findFirst({
      where: { id: input.requestItemId, requestId: input.requestId },
      select: { id: true }
    }),
    tx.requestSelectionBatchItem.findFirst({
      where: {
        sourceRequestItemId: input.requestItemId,
        status: 'APPROVED',
        batch: {
          requestId: input.requestId,
          status: { in: ['APPROVED', 'PARTIALLY_APPROVED'] }
        }
      },
      select: { id: true }
    }),
    tx.invoiceItem.findFirst({
      where: {
        requestItemId: input.requestItemId,
        invoice: { requestId: input.requestId }
      },
      select: { id: true }
    })
  ]);

  if (!item) {
    throw new RequestItemDeleteError('REQUEST_ITEM_NOT_FOUND', input);
  }
  if (approvedSnapshot || invoiceItem) {
    throw new RequestItemDeleteError(
      'APPROVED_REQUEST_ITEM_DELETE_BLOCKED',
      input
    );
  }
}
