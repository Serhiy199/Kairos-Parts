import { Prisma } from '@prisma/client';

export const LOGISTICS_TARIFF_MAX_WHOLE_UAH = new Prisma.Decimal('9999999999');

const WHOLE_UAH_PATTERN = /^\d{1,10}$/;

export function parseLogisticsTariffPrice(value: string): Prisma.Decimal | null {
  const normalized = value.trim();
  if (!WHOLE_UAH_PATTERN.test(normalized)) return null;

  const price = new Prisma.Decimal(normalized);
  if (
    price.lessThanOrEqualTo(0) ||
    price.greaterThan(LOGISTICS_TARIFF_MAX_WHOLE_UAH)
  ) {
    return null;
  }

  return price;
}
