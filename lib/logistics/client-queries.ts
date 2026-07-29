import 'server-only';

import type {
  LogisticsDestinationType,
  LogisticsRequestStatus
} from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';
import { logisticsRequestAccessWhere } from '@/lib/logistics/client-access';
import { prisma } from '@/lib/prisma';

export const CLIENT_LOGISTICS_PAGE_SIZE = 20;

export type ClientLogisticsListItem = {
  id: string;
  requestNumber: string;
  createdAt: string;
  tariffCityName: string;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
  totalPrice: string;
  status: LogisticsRequestStatus;
};

export type ClientLogisticsDetail = {
  requestNumber: string;
  createdAt: string;
  updatedAt: string;
  status: LogisticsRequestStatus;
  contactName: string;
  contactPhone: string;
  tariffCityName: string;
  baseTariff: string;
  pickupPointCount: number;
  additionalPointsCharge: string;
  farmDeliveryCharge: string;
  totalPrice: string;
  destinationType: LogisticsDestinationType;
  destinationAddress: string | null;
  clientComment: string | null;
  pickupPoints: Array<{
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
    tariffCityName: record.tariffCityNameSnapshot,
    pickupPointCount: record.pickupPointCount,
    destinationType: record.destinationType,
    totalPrice: record.totalPrice.toFixed(2),
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
      status: true,
      contactName: true,
      contactPhone: true,
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
    status: record.status,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    tariffCityName: record.tariffCityNameSnapshot,
    baseTariff: record.baseTariffSnapshot.toFixed(2),
    pickupPointCount: record.pickupPointCount,
    additionalPointsCharge: record.additionalPointsCharge.toFixed(2),
    farmDeliveryCharge: record.farmDeliveryCharge.toFixed(2),
    totalPrice: record.totalPrice.toFixed(2),
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
