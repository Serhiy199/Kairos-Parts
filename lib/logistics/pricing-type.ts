import type { LogisticsPricingType } from '@prisma/client';

export const LOGISTICS_PRICING_TYPES = [
  'FIXED',
  'INDIVIDUAL'
] as const satisfies readonly LogisticsPricingType[];

export type LogisticsPricingTypeValue =
  (typeof LOGISTICS_PRICING_TYPES)[number];

export const INDIVIDUAL_PRICING_SELECT_VALUE = 'INDIVIDUAL';

export const LOGISTICS_PRICING_TYPE_LABELS: Record<
  LogisticsPricingTypeValue,
  string
> = {
  FIXED: 'Фіксований тариф',
  INDIVIDUAL: 'Індивідуальний розрахунок'
};

export const LOGISTICS_CUSTOM_LOCALITY_MIN_LENGTH = 2;
export const LOGISTICS_CUSTOM_LOCALITY_MAX_LENGTH = 200;

export function isLogisticsPricingType(
  value: string
): value is LogisticsPricingTypeValue {
  return LOGISTICS_PRICING_TYPES.includes(
    value as LogisticsPricingTypeValue
  );
}

export function normalizeLogisticsCustomLocality(value: string) {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
