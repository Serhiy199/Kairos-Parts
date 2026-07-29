import { Prisma, type LogisticsDestinationType } from '@prisma/client';

import {
  LOGISTICS_ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS,
  LOGISTICS_FARM_DELIVERY_CHARGE_MINOR_UNITS
} from '@/lib/logistics/constants';

export type LogisticsPricingInput = {
  baseTariff: Prisma.Decimal;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
};

export type LogisticsPricingBreakdown = {
  baseTariff: Prisma.Decimal;
  additionalPickupCount: number;
  additionalPointsCharge: Prisma.Decimal;
  farmDeliveryCharge: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
};

function decimalFromMinorUnits(minorUnits: number) {
  return new Prisma.Decimal(minorUnits).dividedBy(100);
}
export const LOGISTICS_ADDITIONAL_PICKUP_CHARGE = decimalFromMinorUnits(
  LOGISTICS_ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS
);
export const LOGISTICS_FARM_DELIVERY_CHARGE = decimalFromMinorUnits(
  LOGISTICS_FARM_DELIVERY_CHARGE_MINOR_UNITS
);

export function calculateAuthoritativeLogisticsPrice({
  baseTariff,
  pickupPointCount,
  destinationType
}: LogisticsPricingInput): LogisticsPricingBreakdown {
  if (!Number.isInteger(pickupPointCount) || pickupPointCount < 1) {
    throw new Error('Pickup point count must be a positive integer.');
  }

  if (destinationType !== 'KAIROS_BASE' && destinationType !== 'FARM') {
    throw new Error('Unknown logistics destination type.');
  }

  const normalizedBaseTariff = new Prisma.Decimal(baseTariff);
  if (normalizedBaseTariff.isNegative()) {
    throw new Error('Base tariff must be nonnegative.');
  }

  const additionalPickupCount = Math.max(0, pickupPointCount - 1);
  const additionalPointsCharge = LOGISTICS_ADDITIONAL_PICKUP_CHARGE.times(
    additionalPickupCount
  );
  const farmDeliveryCharge =
    destinationType === 'FARM'
      ? LOGISTICS_FARM_DELIVERY_CHARGE
      : new Prisma.Decimal(0);

  return {
    baseTariff: normalizedBaseTariff,
    additionalPickupCount,
    additionalPointsCharge,
    farmDeliveryCharge,
    totalPrice: normalizedBaseTariff
      .plus(additionalPointsCharge)
      .plus(farmDeliveryCharge)
  };
}

export function serializeLogisticsMoney(value: Prisma.Decimal) {
  return value.toFixed(2);
}
