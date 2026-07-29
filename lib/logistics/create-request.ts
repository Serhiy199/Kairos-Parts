import { Prisma, type LogisticsAddressProvider, type LogisticsDestinationType } from '@prisma/client';

import {
  auditAnonymousActor,
  auditUserActor,
  writeAuditLog
} from '@/lib/audit-log/service';
import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import type { LogisticsSubmitIdentity } from '@/lib/logistics/access';
import type { LogisticsPricingBreakdown } from '@/lib/logistics/pricing';
import { LogisticsRequestError } from '@/lib/logistics/request-errors';
import type { LogisticsTariffCityCode } from '@/lib/logistics/tariff-cities';
import { prisma } from '@/lib/prisma';

export type PreparedLogisticsRequest = {
  identity: LogisticsSubmitIdentity;
  idempotencyKey: string;
  contactName: string;
  contactPhone: string;
  tariff: {
    id: string;
    code: LogisticsTariffCityCode;
    name: string;
    price: Prisma.Decimal;
  };
  destinationType: LogisticsDestinationType;
  baseAddressSnapshot: string | null;
  farmAddress: {
    formattedAddress: string;
    externalAddressId: string | null;
    addressProvider: LogisticsAddressProvider;
    normalizedLocality: string | null;
    normalizedAdministrativeArea: string | null;
  } | null;
  pickupPoints: Array<{
    supplierName: string;
    formattedAddress: string;
    externalAddressId: string | null;
    addressProvider: LogisticsAddressProvider;
    normalizedLocality: string | null;
    normalizedAdministrativeArea: string | null;
    cargoDescription: string;
  }>;
  pricing: LogisticsPricingBreakdown;
  clientComment: string | null;
  requestContext?: AuditRequestContext;
};

type ExistingRequest = Awaited<ReturnType<typeof findExistingRequest>>;

const existingRequestSelect = {
  id: true,
  requestNumber: true,
  totalPrice: true,
  status: true,
  clientId: true,
  companyId: true,
  contactName: true,
  contactPhone: true,
  tariffCityCodeSnapshot: true,
  destinationType: true,
  farmFormattedAddress: true,
  clientComment: true,
  pickupPoints: {
    select: {
      supplierName: true,
      formattedAddress: true,
      cargoDescription: true
    }
  }
} satisfies Prisma.LogisticsRequestSelect;

async function findExistingRequest(
  writer: Prisma.TransactionClient | typeof prisma,
  idempotencyKey: string
) {
  return writer.logisticsRequest.findUnique({
    where: { idempotencyKey },
    select: existingRequestSelect
  });
}
function pickupIntent(
  points: Array<{
    supplierName: string | null;
    formattedAddress: string;
    cargoDescription: string;
  }>
) {
  return points
    .map(
      (point) =>
        `${point.supplierName ?? ''}\u0000${point.formattedAddress}\u0000${point.cargoDescription}`
    )
    .sort();
}

export function logisticsIdempotencyIntentMatches(
  existing: Omit<NonNullable<ExistingRequest>, 'id'>,
  input: PreparedLogisticsRequest
) {
  const identityMatches =
    input.identity.type === 'GUEST'
      ? existing.clientId === null &&
        existing.companyId === null &&
        existing.contactPhone === input.contactPhone
      : existing.clientId === input.identity.clientId &&
        existing.companyId === input.identity.companyId;
  const existingPoints = pickupIntent(existing.pickupPoints);
  const incomingPoints = pickupIntent(input.pickupPoints);

  return (
    identityMatches &&
    existing.contactName === input.contactName &&
    existing.tariffCityCodeSnapshot === input.tariff.code &&
    existing.destinationType === input.destinationType &&
    existing.farmFormattedAddress ===
      (input.farmAddress?.formattedAddress ?? null) &&
    existing.clientComment === input.clientComment &&
    existingPoints.length === incomingPoints.length &&
    existingPoints.every((point, index) => point === incomingPoints[index])
  );
}

function idempotentResult(existing: NonNullable<ExistingRequest>) {
  return {
    id: existing.id,
    requestNumber: existing.requestNumber,
    totalPrice: existing.totalPrice,
    status: existing.status,
    createdNew: false
  };
}

function idempotencyConflict() {
  return new LogisticsRequestError(
    'IDEMPOTENCY_CONFLICT',
    409,
    'Цей ключ надсилання вже використано для іншої заявки.'
  );
}

export async function createLogisticsRequestInTransaction(
  writer: Prisma.TransactionClient,
  input: PreparedLogisticsRequest
) {
  const existing = await findExistingRequest(writer, input.idempotencyKey);
  if (existing) {
    if (!logisticsIdempotencyIntentMatches(existing, input)) {
      throw idempotencyConflict();
    }
    return idempotentResult(existing);
  }

  const created = await writer.logisticsRequest.create({
    data: {
      status: 'NEW',
      clientId: input.identity.clientId,
      companyId: input.identity.companyId,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      tariffCityId: input.tariff.id,
      tariffCityCodeSnapshot: input.tariff.code,
      tariffCityNameSnapshot: input.tariff.name,
      baseTariffSnapshot: input.pricing.baseTariff,
      destinationType: input.destinationType,
      baseAddressSnapshot: input.baseAddressSnapshot,
      farmFormattedAddress: input.farmAddress?.formattedAddress ?? null,
      farmExternalAddressId: input.farmAddress?.externalAddressId ?? null,
      farmAddressProvider: input.farmAddress?.addressProvider ?? null,
      farmNormalizedLocality: input.farmAddress?.normalizedLocality ?? null,
      pickupPointCount: input.pickupPoints.length,
      additionalPointsCharge: input.pricing.additionalPointsCharge,
      farmDeliveryCharge: input.pricing.farmDeliveryCharge,
      totalPrice: input.pricing.totalPrice,
      clientComment: input.clientComment,
      idempotencyKey: input.idempotencyKey,
      pickupPoints: {
        create: input.pickupPoints.map((point) => ({
          supplierName: point.supplierName,
          formattedAddress: point.formattedAddress,
          externalAddressId: point.externalAddressId,
          addressProvider: point.addressProvider,
          normalizedLocality: point.normalizedLocality,
          normalizedAdministrativeArea: point.normalizedAdministrativeArea,
          cargoDescription: point.cargoDescription
        }))
      }
    },
    select: {
      id: true,
      requestNumber: true,
      totalPrice: true,
      status: true
    }
  });

  await writeAuditLog(writer, {
    actor:
      input.identity.type === 'CLIENT'
        ? auditUserActor(input.identity.userId)
        : auditAnonymousActor(),
    companyId: input.identity.companyId,
    entityType: 'LOGISTICS_REQUEST',
    entityId: created.id,
    entityLabel: created.requestNumber,
    action: 'LOGISTICS_REQUEST_CREATED',
    category: 'STANDARD',
    newValue: {
      requestNumber: created.requestNumber,
      source: input.identity.type,
      tariffCityCode: input.tariff.code,
      pickupPointCount: input.pickupPoints.length,
      destinationType: input.destinationType,
      totalPrice: input.pricing.totalPrice,
      vatIncluded: true
    },
    allowedFields: {
      newValue: [
        'requestNumber',
        'source',
        'tariffCityCode',
        'pickupPointCount',
        'destinationType',
        'totalPrice',
        'vatIncluded'
      ]
    },
    requestContext: input.requestContext
  });

  return {
    id: created.id,
    requestNumber: created.requestNumber,
    totalPrice: created.totalPrice,
    status: created.status,
    createdNew: true
  };
}

export async function createLogisticsRequest(input: PreparedLogisticsRequest) {
  try {
    return await prisma.$transaction((writer) =>
      createLogisticsRequestInTransaction(writer, input)
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await findExistingRequest(prisma, input.idempotencyKey);
      if (existing && logisticsIdempotencyIntentMatches(existing, input)) {
        return idempotentResult(existing);
      }
      throw idempotencyConflict();
    }

    throw error;
  }
}
