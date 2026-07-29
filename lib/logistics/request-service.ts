import 'server-only';

import type { LogisticsSubmitIdentity } from '@/lib/logistics/access';
import { KAIROS_LOGISTICS_BASE_ADDRESS } from '@/lib/logistics/constants';
import {
  compareDateOnly,
  getKyivTodayDateOnly,
  serializeDateOnly
} from '@/lib/logistics/date-only';
import {
  createLogisticsRequest,
  type PreparedLogisticsRequest
} from '@/lib/logistics/create-request';
import {
  calculateAuthoritativeLogisticsPrice,
  serializeLogisticsMoney
} from '@/lib/logistics/pricing';
import type { LogisticsCreateInput } from '@/lib/logistics/request-input';
import { LogisticsRequestError } from '@/lib/logistics/request-errors';
import { getActiveLogisticsTariff } from '@/lib/logistics/tariff-service';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
import { notifyNewLogisticsRequest } from '@/lib/staff-telegram/notifications';
import type { AuditRequestContext } from '@/lib/audit-log/contracts';

export async function prepareLogisticsRequest(input: {
  parsed: LogisticsCreateInput;
  identity: LogisticsSubmitIdentity;
  requestContext?: AuditRequestContext;
}): Promise<PreparedLogisticsRequest> {
  const canonicalPhone = normalizeUkrainianPhone(input.parsed.contactPhone);
  if (!canonicalPhone) {
    throw new LogisticsRequestError(
      'INVALID_CONTACT_PHONE',
      422,
      'Введіть український номер у форматі +380XXXXXXXXX.',
      'contactPhone'
    );
  }
  if (
    compareDateOnly(
      input.parsed.preferredDeliveryDate.value,
      getKyivTodayDateOnly()
    ) < 0
  ) {
    throw new LogisticsRequestError(
      'PREFERRED_DELIVERY_DATE_IN_PAST',
      422,
      'Бажана дата перевезення не може бути в минулому.',
      'preferredDeliveryDate'
    );
  }

  const tariff = await getActiveLogisticsTariff(input.parsed.tariffCityCode);
  const pricing = calculateAuthoritativeLogisticsPrice({
    baseTariff: tariff.price,
    pickupPointCount: input.parsed.pickupPoints.length,
    destinationType: input.parsed.destinationType
  });

  return {
    identity: input.identity,
    idempotencyKey: input.parsed.idempotencyKey,
    contactName: input.parsed.contactName,
    contactPhone: canonicalPhone,
    tariff,
    destinationType: input.parsed.destinationType,
    preferredDeliveryDate: input.parsed.preferredDeliveryDate.date,
    preferredDeliveryDateValue: input.parsed.preferredDeliveryDate.value,
    baseAddressSnapshot:
      input.parsed.destinationType === 'KAIROS_BASE'
        ? KAIROS_LOGISTICS_BASE_ADDRESS
        : null,
    farmAddress:
      input.parsed.destinationType === 'FARM' && input.parsed.farmAddress
        ? {
            formattedAddress: input.parsed.farmAddress,
            externalAddressId: null,
            addressProvider: 'MANUAL',
            normalizedLocality: null,
            normalizedAdministrativeArea: null
          }
        : null,
    pickupPoints: input.parsed.pickupPoints.map((point) => ({
      supplierName: point.supplierName,
      formattedAddress: point.address,
      externalAddressId: null,
      addressProvider: 'MANUAL',
      normalizedLocality: null,
      normalizedAdministrativeArea: null,
      cargoDescription: point.cargoDescription
    })),
    pricing,
    clientComment: input.parsed.clientComment,
    requestContext: input.requestContext
  };
}

export async function createPreparedLogisticsRequest(
  input: PreparedLogisticsRequest
) {
  const result = await createLogisticsRequest(input);

  if (result.createdNew) {
    await notifyNewLogisticsRequest({
      id: result.id,
      requestNumber: result.requestNumber,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      tariffCityName: input.tariff.name,
      pickupPointCount: input.pickupPoints.length,
      destinationType: input.destinationType,
      preferredDeliveryDate: serializeDateOnly(result.preferredDeliveryDate),
      totalPrice: serializeLogisticsMoney(result.totalPrice)
    });
  }

  return {
    requestNumber: result.requestNumber,
    totalPrice: serializeLogisticsMoney(result.totalPrice),
    currency: 'UAH' as const,
    vatIncluded: true as const,
    status: result.status,
    preferredDeliveryDate: serializeDateOnly(result.preferredDeliveryDate)
  };
}
