export const REQUEST_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'OFFER_PREPARING',
  'WAITING_APPROVAL',
  'ORDERED',
  'IN_DELIVERY',
  'COMPLETED',
  'CANCELLED'
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_ORDER: Record<RequestStatus, number> = {
  NEW: 1,
  IN_PROGRESS: 2,
  OFFER_PREPARING: 3,
  WAITING_APPROVAL: 4,
  ORDERED: 5,
  IN_DELIVERY: 6,
  COMPLETED: 7,
  CANCELLED: 8
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: 'Нова заявка',
  IN_PROGRESS: 'В роботі',
  OFFER_PREPARING: 'Формується пропозиція',
  WAITING_APPROVAL: 'Очікує погодження',
  ORDERED: 'Замовлено',
  IN_DELIVERY: 'В дорозі',
  COMPLETED: 'Завершено',
  CANCELLED: 'Скасовано'
};

export const REQUEST_STATUS_DESCRIPTIONS: Record<RequestStatus, string> = {
  NEW: 'Заявку отримано. Менеджер перевірить дані та звʼяжеться для уточнення.',
  IN_PROGRESS: 'Менеджер уже працює із заявкою та перевіряє потребу.',
  OFFER_PREPARING: 'Формується пропозиція з доступними позиціями, аналогами або варіантами постачання.',
  WAITING_APPROVAL: 'Пропозиція очікує погодження клієнта.',
  ORDERED: 'Погоджені позиції замовлено у постачальника.',
  IN_DELIVERY: 'Запчастини в дорозі або готуються до передачі клієнту.',
  COMPLETED: 'Заявку завершено.',
  CANCELLED: 'Заявку скасовано.'
};

export const REQUEST_STATUS_BADGES: Record<RequestStatus, { background: string; text: string }> = {
  NEW: { background: '#EFF6FF', text: '#1D4E89' },
  IN_PROGRESS: { background: '#EAF2FA', text: '#2563A6' },
  OFFER_PREPARING: { background: '#FFF7D6', text: '#8A6100' },
  WAITING_APPROVAL: { background: '#FEF3C7', text: '#92400E' },
  ORDERED: { background: '#EDE9FE', text: '#5B3DB2' },
  IN_DELIVERY: { background: '#E0F2FE', text: '#0369A1' },
  COMPLETED: { background: '#E7F6EC', text: '#2E7D4F' },
  CANCELLED: { background: '#FEE4E2', text: '#B42318' }
};

export function getRequestStatusMeta(status: RequestStatus) {
  return {
    status,
    label: REQUEST_STATUS_LABELS[status],
    description: REQUEST_STATUS_DESCRIPTIONS[status],
    badge: REQUEST_STATUS_BADGES[status],
    order: REQUEST_STATUS_ORDER[status]
  };
}

export function formatRequestStatus(status: RequestStatus) {
  return REQUEST_STATUS_LABELS[status];
}
