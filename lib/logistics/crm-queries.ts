import 'server-only';

import type {
  LogisticsDestinationType,
  LogisticsRequestStatus,
  Prisma
} from '@prisma/client';

import {
  isLogisticsCrmSource,
  isLogisticsDestinationType,
  isLogisticsRequestStatus,
  resolveLogisticsSourceKind,
  type LogisticsCrmSource
} from '@/lib/logistics/crm-presentation';
import {
  isLogisticsTariffCityCode,
  LOGISTICS_TARIFF_CITIES,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';
import { prisma } from '@/lib/prisma';

export const LOGISTICS_CRM_PAGE_SIZE = 25;
const SEARCH_MAX_LENGTH = 80;

export type LogisticsCrmSearchParams = {
  page?: string;
  q?: string;
  status?: string;
  tariffCity?: string;
  destination?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type LogisticsCrmFilters = {
  page: number;
  q: string;
  status: LogisticsRequestStatus | null;
  tariffCity: LogisticsTariffCityCode | null;
  destination: LogisticsDestinationType | null;
  source: LogisticsCrmSource | null;
  dateFrom: string;
  dateTo: string;
};

function bounded(value: string | undefined, maxLength: number) {
  return value?.trim().slice(0, maxLength) ?? '';
}

function validDate(value: string | undefined) {
  const candidate = bounded(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';
  const [year, month, day] = candidate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? candidate
    : '';
}

export function parseLogisticsCrmFilters(
  params: LogisticsCrmSearchParams
): LogisticsCrmFilters {
  const requestedPage = Number.parseInt(bounded(params.page, 9), 10);
  const status = bounded(params.status, 32);
  const tariffCity = bounded(params.tariffCity, 64);
  const destination = bounded(params.destination, 32);
  const source = bounded(params.source, 16);

  return {
    page:
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    q: bounded(params.q, SEARCH_MAX_LENGTH),
    status: isLogisticsRequestStatus(status) ? status : null,
    tariffCity: isLogisticsTariffCityCode(tariffCity) ? tariffCity : null,
    destination: isLogisticsDestinationType(destination)
      ? destination
      : null,
    source: isLogisticsCrmSource(source) ? source : null,
    dateFrom: validDate(params.dateFrom),
    dateTo: validDate(params.dateTo)
  };
}

function logisticsWhere(
  filters: LogisticsCrmFilters
): Prisma.LogisticsRequestWhereInput {
  const where: Prisma.LogisticsRequestWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.tariffCity) {
    where.tariffCityCodeSnapshot = filters.tariffCity;
  }
  if (filters.destination) where.destinationType = filters.destination;
  if (filters.source === 'GUEST') {
    where.clientId = null;
    where.companyId = null;
  }
  if (filters.source === 'CLIENT') {
    where.OR = [{ clientId: { not: null } }, { companyId: { not: null } }];
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom
        ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) }
        : {}),
      ...(filters.dateTo
        ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) }
        : {})
    };
  }
  if (filters.q) {
    const searchConditions: Prisma.LogisticsRequestWhereInput[] = [
      {
        requestNumber: {
          contains: filters.q,
          mode: 'insensitive'
        }
      },
      {
        contactName: {
          contains: filters.q,
          mode: 'insensitive'
        }
      },
      {
        contactPhone: {
          contains: filters.q,
          mode: 'insensitive'
        }
      }
    ];
    where.AND = [
      ...(!where.OR ? [] : [{ OR: where.OR }]),
      { OR: searchConditions }
    ];
    delete where.OR;
  }

  return where;
}

export async function getLogisticsCrmPage(filters: LogisticsCrmFilters) {
  const where = logisticsWhere(filters);
  const totalCount = await prisma.logisticsRequest.count({ where });
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / LOGISTICS_CRM_PAGE_SIZE)
  );
  const page = Math.min(filters.page, totalPages);

  const records = await prisma.logisticsRequest.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * LOGISTICS_CRM_PAGE_SIZE,
    take: LOGISTICS_CRM_PAGE_SIZE,
    select: {
      id: true,
      requestNumber: true,
      createdAt: true,
      contactName: true,
      contactPhone: true,
      tariffCityCodeSnapshot: true,
      tariffCityNameSnapshot: true,
      pickupPointCount: true,
      destinationType: true,
      totalPrice: true,
      status: true,
      clientId: true,
      companyId: true
    }
  });

  return {
    records: records.map((record) => ({
      id: record.id,
      requestNumber: record.requestNumber,
      createdAt: record.createdAt.toISOString(),
      contactName: record.contactName,
      contactPhone: record.contactPhone,
      tariffCityCode: record.tariffCityCodeSnapshot,
      tariffCityName: record.tariffCityNameSnapshot,
      pickupPointCount: record.pickupPointCount,
      destinationType: record.destinationType,
      totalPrice: record.totalPrice.toFixed(2),
      status: record.status,
      source: resolveLogisticsSourceKind(record)
    })),
    page,
    pageSize: LOGISTICS_CRM_PAGE_SIZE,
    totalCount,
    totalPages
  };
}

export async function getLogisticsRequestDetail(id: string) {
  const record = await prisma.logisticsRequest.findUnique({
    where: { id },
    select: {
      id: true,
      requestNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      clientId: true,
      companyId: true,
      contactName: true,
      contactPhone: true,
      tariffCityCodeSnapshot: true,
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
      client: {
        select: {
          contactName: true,
          companyName: true
        }
      },
      company: {
        select: {
          name: true
        }
      },
      pickupPoints: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          formattedAddress: true,
          cargoDescription: true
        }
      },
      internalComments: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!record) return null;

  return {
    id: record.id,
    requestNumber: record.requestNumber,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    source: resolveLogisticsSourceKind(record),
    sourceName:
      record.company?.name ??
      record.client?.companyName ??
      record.client?.contactName ??
      null,
    contactName: record.contactName,
    contactPhone: record.contactPhone,
    tariffCityCode: record.tariffCityCodeSnapshot,
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
    pickupPoints: record.pickupPoints,
    internalComments: record.internalComments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      authorName:
        comment.author?.name ??
        comment.author?.email ??
        'Користувач недоступний'
    }))
  };
}

export async function getLogisticsTariffs() {
  const records = await prisma.logisticsTariffCity.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      price: true,
      isActive: true,
      updatedAt: true
    }
  });
  const order = new Map(
    LOGISTICS_TARIFF_CITIES.map((city, index) => [city.code, index])
  );

  return records
    .map((record) => ({
      id: record.id,
      code: record.code,
      name: record.name,
      price: record.price.toFixed(2),
      isActive: record.isActive,
      updatedAt: record.updatedAt.toISOString()
    }))
    .sort(
      (left, right) =>
        (order.get(left.code as LogisticsTariffCityCode) ??
          Number.MAX_SAFE_INTEGER) -
        (order.get(right.code as LogisticsTariffCityCode) ??
          Number.MAX_SAFE_INTEGER)
    );
}

export function logisticsCrmQuery(
  filters: LogisticsCrmFilters,
  overrides: Partial<LogisticsCrmFilters> = {}
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.status) params.set('status', next.status);
  if (next.tariffCity) params.set('tariffCity', next.tariffCity);
  if (next.destination) params.set('destination', next.destination);
  if (next.source) params.set('source', next.source);
  if (next.dateFrom) params.set('dateFrom', next.dateFrom);
  if (next.dateTo) params.set('dateTo', next.dateTo);
  if (next.page > 1) params.set('page', String(next.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}
