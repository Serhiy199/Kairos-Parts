import type {
  RequestSelectionBatchItemStatus,
  RequestSelectionBatchStatus
} from '@prisma/client';

export const REQUEST_SELECTION_BATCH_STATUS_LABELS = {
  DRAFT: 'Чернетка',
  SENT: 'Надіслано на погодження',
  APPROVED: 'Погоджено',
  PARTIALLY_APPROVED: 'Частково погоджено',
  REJECTED: 'Відхилено',
  SUPERSEDED: 'Замінено новішою версією'
} as const satisfies Record<RequestSelectionBatchStatus, string>;

export const REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS = {
  PENDING: 'Очікує рішення',
  APPROVED: 'Погоджено',
  REJECTED: 'Відхилено'
} as const satisfies Record<RequestSelectionBatchItemStatus, string>;
