import type { LogisticsTariffCityCode } from '@/lib/logistics/tariff-cities';
import {
  LOGISTICS_ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS,
  LOGISTICS_FARM_DELIVERY_CHARGE_MINOR_UNITS
} from '@/lib/logistics/constants';

export type LogisticsDestinationType = 'KAIROS_BASE' | 'FARM';

export type LogisticsTariffClientItem = {
  readonly code: LogisticsTariffCityCode;
  readonly name: string;
  readonly priceMinorUnits: number;
};

export const ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS =
  LOGISTICS_ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS;
export const FARM_DELIVERY_CHARGE_MINOR_UNITS =
  LOGISTICS_FARM_DELIVERY_CHARGE_MINOR_UNITS;

export type LogisticsPricePreview = {
  cityCode: LogisticsTariffCityCode;
  cityName: string;
  baseTariffMinorUnits: number;
  additionalPointCount: number;
  additionalPointsMinorUnits: number;
  farmDeliveryMinorUnits: number;
  totalMinorUnits: number;
};

export function calculateLogisticsPricePreview(
  tariff: LogisticsTariffClientItem,
  pickupPointCount: number,
  destinationType: LogisticsDestinationType
): LogisticsPricePreview {
  if (!Number.isInteger(pickupPointCount) || pickupPointCount < 1) {
    throw new Error('Pickup point count must be a positive integer.');
  }

  const additionalPointCount = Math.max(0, pickupPointCount - 1);
  const additionalPointsMinorUnits =
    additionalPointCount * ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS;
  const farmDeliveryMinorUnits =
    destinationType === 'FARM' ? FARM_DELIVERY_CHARGE_MINOR_UNITS : 0;

  return {
    cityCode: tariff.code,
    cityName: tariff.name,
    baseTariffMinorUnits: tariff.priceMinorUnits,
    additionalPointCount,
    additionalPointsMinorUnits,
    farmDeliveryMinorUnits,
    totalMinorUnits:
      tariff.priceMinorUnits +
      additionalPointsMinorUnits +
      farmDeliveryMinorUnits
  };
}

export function formatLogisticsPrice(minorUnits: number) {
  if (!Number.isInteger(minorUnits) || minorUnits < 0) {
    throw new Error('Price must use nonnegative integer minor units.');
  }

  return `${new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: 0
  }).format(minorUnits / 100)} грн`;
}
