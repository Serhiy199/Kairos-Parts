import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  isLogisticsTariffCityCode,
  LOGISTICS_TARIFF_CITIES,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';

export type LogisticsTariffReadModel = {
  id: string;
  code: LogisticsTariffCityCode;
  name: string;
  price: Prisma.Decimal;
  isActive: boolean;
  updatedAt: Date;
};

type TariffReader = Pick<typeof prisma, 'logisticsTariffCity'> | Prisma.TransactionClient;

const tariffSelect = {
  id: true,
  code: true,
  name: true,
  price: true,
  isActive: true,
  updatedAt: true
} satisfies Prisma.LogisticsTariffCitySelect;

function asReadModel(record: {
  id: string;
  code: string;
  name: string;
  price: Prisma.Decimal;
  isActive: boolean;
  updatedAt: Date;
}): LogisticsTariffReadModel {
  if (!isLogisticsTariffCityCode(record.code)) {
    throw new Error(`Unknown configured logistics tariff city: ${record.code}`);
  }

  return { ...record, code: record.code };
}

export async function getConfiguredLogisticsTariffs(
  reader: TariffReader = prisma
): Promise<LogisticsTariffReadModel[]> {
  const records = await reader.logisticsTariffCity.findMany({
    select: tariffSelect
  });
  const order = new Map(
    LOGISTICS_TARIFF_CITIES.map((city, index) => [city.code, index])
  );

  return records
    .map(asReadModel)
    .sort((left, right) => order.get(left.code)! - order.get(right.code)!);
}

export async function getActiveLogisticsTariffs(
  reader: TariffReader = prisma
): Promise<LogisticsTariffReadModel[]> {
  return (await getConfiguredLogisticsTariffs(reader)).filter(
    (tariff) => tariff.isActive
  );
}

export async function findLogisticsTariffByCode(
  code: string,
  reader: TariffReader = prisma
): Promise<LogisticsTariffReadModel | null> {
  if (!isLogisticsTariffCityCode(code)) return null;

  const record = await reader.logisticsTariffCity.findUnique({
    where: { code },
    select: tariffSelect
  });

  return record ? asReadModel(record) : null;
}

export async function findLockedLogisticsTariffByCode(
  code: LogisticsTariffCityCode,
  reader: Prisma.TransactionClient
): Promise<LogisticsTariffReadModel | null> {
  const records = await reader.$queryRaw<
    Array<{
      id: string;
      code: string;
      name: string;
      price: Prisma.Decimal;
      isActive: boolean;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      "id",
      "code",
      "name",
      "price",
      "isActive",
      "updatedAt"
    FROM "LogisticsTariffCity"
    WHERE "code" = ${code}
    FOR SHARE
  `);

  return records[0] ? asReadModel(records[0]) : null;
}
