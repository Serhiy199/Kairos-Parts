import 'server-only';

import type {
  LogisticsDestinationType,
  LogisticsPricingType,
  LogisticsRequestStatus
} from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';
import { logisticsRequestAccessWhere } from '@/lib/logistics/client-access';
import { prisma } from '@/lib/prisma';
import { serializeDateOnly } from '@/lib/logistics/date-only';

export const CLIENT_LOGISTICS_PAGE_SIZE = 20;

export type ClientLogisticsListItem = {
  id: string;
  requestNumber: string;
  createdAt: string;
  preferredDeliveryDate: string | null;
  pricingType: LogisticsPricingType;
  customLocality: string | null;
  tariffCityName: string | null;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
  totalPrice: string | null;
  status: LogisticsRequestStatus;
};

export type ClientLogisticsDetail = {
  requestNumber: string;
  createdAt: string;
  updatedAt: string;
  preferredDeliveryDate: string | null;
  status: LogisticsRequestStatus;
  contactName: string;
  contactPhone: string;
  pricingType: LogisticsPricingType;
  customLocality: string | null;
  tariffCityName: string | null;
  baseTariff: string | null;
  pickupPointCount: number;
  additionalPointsCharge: string | null;
  farmDeliveryCharge: string | null;
  totalPrice: string | null;
  destinationType: LogisticsDestinationType;
  destinationAddress: string | null;
  clientComment: string | null;
  pickupPoints: Array<{
    supplierName: string | null;
    formattedAddress: string;
    cargoDescription: string;
  }>;
};

export async function getClientLogisticsPage(
  access: ClientAccessContext,
  requestedPage: number
) {
  const where = logisticsRequestAccessWhere(access);
  const totalCount = await prisma.logisticsRequest.count({ where });
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / CLIENT_LOGISTICS_PAGE_SIZE)
  );
  const page = Math.min(Math.max(requestedPage, 1), totalPages);

  const records = await prisma.logisticsRequest.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * CLIENT_LOGISTICS_PAGE_SIZE,
    take: CLIENT_LOGISTICS_PAGE_SIZE,
    select: {
      id: true,
      requestNumber: true,
      createdAt: true,
      preferredDeliveryDate: true,
      pricingType: true,
      customLocality: true,
      tariffCityNameSnapshot: true,
      pickupPointCount: true,
      destinationType: true,
      totalPrice: true,
      status: true
    }
  });

  const items: ClientLogisticsListItem[] = records.map((record) => ({
    id: record.id,
    requestNumber: record.requestNumber,
    createdAt: record.createdAt.toISOString(),
    preferredDeliveryDate: serializeDateOnly(record.preferredDeliveryDate),
    pricingType: record.pricingType,
    customLocality: record.customLocality,
    tariffCityName: record.tariffCityNameSnapshot,
    pickupPointCount: record.pickupPointCount,
    destinationType: record.destinationType,
    totalPrice: record.totalPrice?.toFixed(2) ?? null,
    status: record.status
  }));

  return {
    items,
    page,
    pageSize: CLIENT_LOGISTICS_PAGE_SIZE,
    totalCount,
    totalPages
  };
}

export async function getClientLogisticsDetail(
  id: string,
  access: ClientAccessContext
): Promise<ClientLogisticsDetail | null> {
  if (!id || id.length > 64) return null;

  const record = await prisma.logisticsRequest.findFirst({
    where: {
      AND: [{ id }, logisticsRequestAccessWhere(access)]
    },
    select: {
      requestNumber: true,
      createdAt: true,
      updatedAt: true,
      preferredDeliveryDate: true,
      status: true,
      contactName: true,
      contactPhone: true,
      pricingType: true,
      customLocality: true,
      tariffCityNameSnapshot: true,
      baseTariffSnapshot: true,
      pickupPointCount: true,
      additionalPointsCharge: true,
      farmDeliveryCharge: true,
      totalPrice: true,
      destinationType: true,
      baseAddressSnapshot: true,
      farmFormattedAddress: true,
      clientComment: true,
      pickupPoints: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          supplierName: true,
          formattedAddress: true,
          cargoDescription: true
        }
      }
    }
  });

  if (!record) return null;

  return {
    requestNumber: record.requestNumber,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    preferredDeliveryDate: serializeDateOnly(record.preferredDeliveryDate),
    status: record.status,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    pricingType: record.pricingType,
    customLocality: record.customLocality,
    tariffCityName: record.tariffCityNameSnapshot,
    baseTariff: record.baseTariffSnapshot?.toFixed(2) ?? null,
    pickupPointCount: record.pickupPointCount,
    additionalPointsCharge:
      record.additionalPointsCharge?.toFixed(2) ?? null,
    farmDeliveryCharge: record.farmDeliveryCharge?.toFixed(2) ?? null,
    totalPrice: record.totalPrice?.toFixed(2) ?? null,
    destinationType: record.destinationType,
    destinationAddress:
      record.destinationType === 'KAIROS_BASE'
        ? record.baseAddressSnapshot
        : record.farmFormattedAddress,
    clientComment: record.clientComment,
    pickupPoints: record.pickupPoints
  };
}

export function parseClientLogisticsPage(value: string | undefined) {
  const parsed = Number.parseInt(value?.trim().slice(0, 9) ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}
