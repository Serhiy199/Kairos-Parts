import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { LogisticsRequestError } from '@/lib/logistics/request-errors';
import {
  isLogisticsTariffCityCode,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';

type TariffWriter = Pick<typeof prisma, 'logisticsTariffCity'> | Prisma.TransactionClient;

export async function getActiveLogisticsTariff(
  code: string,
  writer: TariffWriter = prisma
) {
  if (!isLogisticsTariffCityCode(code)) {
    throw new LogisticsRequestError(
      'UNKNOWN_TARIFF_CITY',
      422,
      'Оберіть доступне тарифне місто.',
      'tariffCityCode'
    );
  }

  let tariff;
  try {
    tariff = await writer.logisticsTariffCity.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        isActive: true
      }
    });
  } catch {
    throw new LogisticsRequestError(
      'TARIFF_UNAVAILABLE',
      503,
      'Не вдалося завантажити актуальний тариф.'
    );
  }

  if (!tariff) {
    throw new LogisticsRequestError(
      'TARIFF_UNAVAILABLE',
      503,
      'Актуальний тариф тимчасово недоступний.'
    );
  }

  if (!tariff.isActive) {
    throw new LogisticsRequestError(
      'TARIFF_CITY_INACTIVE',
      422,
      'Перевезення з цього міста тимчасово недоступне.',
      'tariffCityCode'
    );
  }

  return {
    id: tariff.id,
    code: tariff.code as LogisticsTariffCityCode,
    name: tariff.name,
    price: tariff.price
  };
}
