import type { LogisticsRequestStatus } from '@prisma/client';

export {
  LOGISTICS_STATUSES as LOGISTICS_CRM_STATUSES,
  LOGISTICS_DESTINATIONS,
  LOGISTICS_DESTINATION_LABELS,
  LOGISTICS_STATUS_LABELS,
  LOGISTICS_PENDING_PRICE_LABEL,
  LOGISTICS_PRICING_TYPE_LABELS,
  formatLogisticsUah,
  formatNullableLogisticsUah,
  isLogisticsDestinationType,
  isLogisticsRequestStatus,
  logisticsStatusClass
} from '@/lib/logistics/presentation';

export const LOGISTICS_CRM_SOURCES = ['GUEST', 'CLIENT'] as const;
export type LogisticsCrmSource = (typeof LOGISTICS_CRM_SOURCES)[number];
export type LogisticsCrmSourceKind =
  | 'GUEST'
  | 'CLIENT'
  | 'COMPANY_CLIENT';

export const LOGISTICS_SOURCE_LABELS: Record<
  LogisticsCrmSourceKind,
  string
> = {
  GUEST: 'Guest',
  CLIENT: 'CLIENT',
  COMPANY_CLIENT: 'Company CLIENT'
};

export const LOGISTICS_STATUS_TRANSITIONS: Record<
  LogisticsRequestStatus,
  readonly LogisticsRequestStatus[]
> = {
  NEW: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

export function isLogisticsCrmSource(
  value: string
): value is LogisticsCrmSource {
  return LOGISTICS_CRM_SOURCES.includes(value as LogisticsCrmSource);
}

export function resolveLogisticsSourceKind(input: {
  clientId: string | null;
  companyId: string | null;
}): LogisticsCrmSourceKind {
  if (input.companyId) return 'COMPANY_CLIENT';
  if (input.clientId) return 'CLIENT';
  return 'GUEST';
}
