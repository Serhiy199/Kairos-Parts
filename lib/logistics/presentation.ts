import type {
  LogisticsDestinationType,
  LogisticsRequestStatus
} from '@prisma/client';
export {
  LOGISTICS_PRICING_TYPE_LABELS
} from '@/lib/logistics/pricing-type';

export const LOGISTICS_PENDING_PRICE_LABEL = 'Очікує розрахунку';
export const LOGISTICS_CLIENT_PENDING_PRICE_LABEL =
  'Очікує розрахунку менеджером';

export const LOGISTICS_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
] as const satisfies readonly LogisticsRequestStatus[];

export const LOGISTICS_STATUS_LABELS: Record<
  LogisticsRequestStatus,
  string
> = {
  NEW: 'Нова',
  IN_PROGRESS: 'У роботі',
  COMPLETED: 'Виконана',
  CANCELLED: 'Скасована'
};

export const LOGISTICS_DESTINATIONS = [
  'KAIROS_BASE',
  'FARM'
] as const satisfies readonly LogisticsDestinationType[];

export const LOGISTICS_DESTINATION_LABELS: Record<
  LogisticsDestinationType,
  string
> = {
  KAIROS_BASE: 'База Kairos',
  FARM: 'Господарство'
};

export const LOGISTICS_DESTINATION_SENTENCE_LABELS: Record<
  LogisticsDestinationType,
  string
> = {
  KAIROS_BASE: 'Доставка на базу Kairos',
  FARM: 'Доставка в господарство'
};

export const LOGISTICS_DESTINATION_DIRECTION_LABELS: Record<
  LogisticsDestinationType,
  string
> = {
  KAIROS_BASE: 'На базу Kairos',
  FARM: 'У господарство'
};

export function isLogisticsRequestStatus(
  value: string
): value is LogisticsRequestStatus {
  return LOGISTICS_STATUSES.includes(value as LogisticsRequestStatus);
}

export function isLogisticsDestinationType(
  value: string
): value is LogisticsDestinationType {
  return LOGISTICS_DESTINATIONS.includes(value as LogisticsDestinationType);
}

export function formatLogisticsUah(value: string) {
  const [whole = '0', fraction = '00'] = value.split('.');
  const normalizedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const normalizedFraction = fraction.padEnd(2, '0').slice(0, 2);
  return `${normalizedWhole},${normalizedFraction} грн`;
}

export function formatLogisticsUahCompact(value: string) {
  const exact = formatLogisticsUah(value);
  const normalizedFraction = (value.split('.')[1] ?? '00')
    .padEnd(2, '0')
    .slice(0, 2);
  return normalizedFraction === '00'
    ? exact.replace(',00 грн', ' грн')
    : exact;
}

export function formatNullableLogisticsUah(
  value: string | null,
  pendingLabel = LOGISTICS_PENDING_PRICE_LABEL
) {
  return value === null ? pendingLabel : formatLogisticsUah(value);
}

export function formatNullableLogisticsUahCompact(
  value: string | null,
  pendingLabel = LOGISTICS_PENDING_PRICE_LABEL
) {
  return value === null ? pendingLabel : formatLogisticsUahCompact(value);
}

export function logisticsStatusClass(status: LogisticsRequestStatus) {
  switch (status) {
    case 'NEW':
      return 'border-accent/35 bg-accent/10 text-foreground';
    case 'IN_PROGRESS':
      return 'border-info/30 bg-info/10 text-info';
    case 'COMPLETED':
      return 'border-success/30 bg-success/10 text-success';
    case 'CANCELLED':
      return 'border-danger/30 bg-danger/10 text-danger';
  }
}
