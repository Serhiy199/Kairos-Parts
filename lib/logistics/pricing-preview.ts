import {
  getLogisticsTariffCity,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';

export type LogisticsDestinationType = 'KAIROS_BASE' | 'FARM';

export const ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS = 50_000;
export const FARM_DELIVERY_CHARGE_MINOR_UNITS = 50_000;

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
  cityCode: LogisticsTariffCityCode,
  pickupPointCount: number,
  destinationType: LogisticsDestinationType
): LogisticsPricePreview {
  if (!Number.isInteger(pickupPointCount) || pickupPointCount < 1) {
    throw new Error('Pickup point count must be a positive integer.');
  }

  const city = getLogisticsTariffCity(cityCode);
  const additionalPointCount = Math.max(0, pickupPointCount - 1);
  const additionalPointsMinorUnits =
    additionalPointCount * ADDITIONAL_PICKUP_CHARGE_MINOR_UNITS;
  const farmDeliveryMinorUnits =
    destinationType === 'FARM' ? FARM_DELIVERY_CHARGE_MINOR_UNITS : 0;

  return {
    cityCode,
    cityName: city.displayName,
    baseTariffMinorUnits: city.previewPriceMinorUnits,
    additionalPointCount,
    additionalPointsMinorUnits,
    farmDeliveryMinorUnits,
    totalMinorUnits:
      city.previewPriceMinorUnits +
      additionalPointsMinorUnits +
      farmDeliveryMinorUnits
  };
}

export function formatLogisticsPrice(minorUnits: number) {
  if (!Number.isInteger(minorUnits) || minorUnits < 0) {
    throw new Error('Price must use nonnegative integer minor units.');
  }

  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(minorUnits / 100);
}
