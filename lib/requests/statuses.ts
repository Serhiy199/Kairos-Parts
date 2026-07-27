import type { RequestStatus as PrismaRequestStatus } from '@prisma/client';

export const REQUEST_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'AWAITING_SHIPMENT',
  'COMPLETED',
  'CANCELLED'
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type AnyRequestStatus = RequestStatus | PrismaRequestStatus;

export const REQUEST_STATUS_ORDER: Record<AnyRequestStatus, number> = {
  NEW: 1,
  IN_PROGRESS: 2,
  OFFER_PREPARING: 2,
  WAITING_APPROVAL: 3,
  AWAITING_INVOICE: 4,
  INVOICE_SENT: 5,
  ORDERED: 6,
  IN_DELIVERY: 6,
  AWAITING_SHIPMENT: 6,
  COMPLETED: 7,
  CANCELLED: 8
};

export const REQUEST_STATUS_LABELS: Record<AnyRequestStatus, string> = {
  NEW: 'Нова заявка',
  IN_PROGRESS: 'Підбір у роботі',
  OFFER_PREPARING: 'Підбір у роботі',
  WAITING_APPROVAL: 'Очікує підтвердження',
  AWAITING_INVOICE: 'Очікує рахунок',
  INVOICE_SENT: 'Рахунок надісланий',
  ORDERED: 'Очікує на відвантаження',
  IN_DELIVERY: 'Очікує на відвантаження',
  AWAITING_SHIPMENT: 'Очікує на відвантаження',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано'
};

export const REQUEST_STATUS_DESCRIPTIONS: Record<AnyRequestStatus, string> = {
  NEW: 'Заявку отримано. Менеджер перевірить дані та звʼяжеться для уточнення.',
  IN_PROGRESS: 'Менеджер підбирає запчастини, перевіряє сумісність і доступність.',
  OFFER_PREPARING: 'Менеджер підбирає запчастини, перевіряє сумісність і доступність.',
  WAITING_APPROVAL: 'Підібране рішення очікує підтвердження клієнта.',
  AWAITING_INVOICE: 'Погоджені позиції очікують формування рахунку.',
  INVOICE_SENT: 'Рахунок надіслано клієнту.',
  ORDERED: 'Підтверджені позиції очікують на відвантаження.',
  IN_DELIVERY: 'Підтверджені позиції очікують на відвантаження.',
  AWAITING_SHIPMENT: 'Підтверджені позиції очікують на відвантаження.',
  COMPLETED: 'Заявку виконано.',
  CANCELLED: 'Заявку скасовано.'
};

export const REQUEST_STATUS_BADGES: Record<AnyRequestStatus, { background: string; text: string }> = {
  NEW: { background: '#EFF6FF', text: '#1D4E89' },
  IN_PROGRESS: { background: '#EAF2FA', text: '#2563A6' },
  OFFER_PREPARING: { background: '#EAF2FA', text: '#2563A6' },
  WAITING_APPROVAL: { background: '#FEF3C7', text: '#92400E' },
  AWAITING_INVOICE: { background: '#FFF7D6', text: '#805B10' },
  INVOICE_SENT: { background: '#E8F1FF', text: '#245EA8' },
  ORDERED: { background: '#F7E7C6', text: '#8A5B24' },
  IN_DELIVERY: { background: '#F7E7C6', text: '#8A5B24' },
  AWAITING_SHIPMENT: { background: '#F7E7C6', text: '#8A5B24' },
  COMPLETED: { background: '#E7F6EC', text: '#2E7D4F' },
  CANCELLED: { background: '#FEE4E2', text: '#B42318' }
};

export function getRequestStatusMeta(status: AnyRequestStatus) {
  return {
    status,
    label: REQUEST_STATUS_LABELS[status],
    description: REQUEST_STATUS_DESCRIPTIONS[status],
    badge: REQUEST_STATUS_BADGES[status],
    order: REQUEST_STATUS_ORDER[status]
  };
}

export function formatRequestStatus(status: AnyRequestStatus) {
  return REQUEST_STATUS_LABELS[status];
}

export function normalizeRequestStatusForSelection(status: AnyRequestStatus): RequestStatus {
  if (status === 'OFFER_PREPARING') {
    return 'IN_PROGRESS';
  }

  if (status === 'ORDERED' || status === 'IN_DELIVERY') {
    return 'AWAITING_SHIPMENT';
  }

  return REQUEST_STATUSES.includes(status as RequestStatus) ? (status as RequestStatus) : 'NEW';
}
