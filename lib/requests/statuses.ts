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
