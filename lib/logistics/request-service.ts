import 'server-only';

import type {
  LogisticsAddressProviderKind,
  LogisticsResolvedAddress
} from '@/lib/logistics/address-provider/contracts';
import { LogisticsAddressError } from '@/lib/logistics/address-provider/errors';
import { getLogisticsAddressProvider } from '@/lib/logistics/address-provider/provider-factory';
import { resolveLogisticsAddress } from '@/lib/logistics/address-provider/service';
import type { LogisticsSubmitIdentity } from '@/lib/logistics/access';
import { KAIROS_LOGISTICS_BASE_ADDRESS } from '@/lib/logistics/constants';
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
import type { AuditRequestContext } from '@/lib/audit-log/contracts';

function addressRequestError(error: unknown, field: string) {
  if (error instanceof LogisticsAddressError) {
    const supportedCode =
      error.code === 'ADDRESS_NOT_FOUND' ||
      error.code === 'ADDRESS_SCOPE_MISMATCH' ||
      error.code === 'ADDRESS_PROVIDER_DISABLED' ||
      error.code === 'ADDRESS_PROVIDER_UNAVAILABLE' ||
      error.code === 'UNKNOWN_TARIFF_CITY'
        ? error.code
        : 'INVALID_REQUEST';

    return new LogisticsRequestError(
      supportedCode,
      error.status,
      error.message,
      field
    );
  }

  return new LogisticsRequestError(
    'ADDRESS_PROVIDER_UNAVAILABLE',
    503,
    'Не вдалося підтвердити адресу. Спробуйте ще раз.',
    field
  );
}

async function resolvePickupAddress(
  provider: ReturnType<typeof getLogisticsAddressProvider>,
  input: LogisticsCreateInput,
  index: number
) {
  try {
    return await resolveLogisticsAddress(provider, {
      externalAddressId: input.pickupPoints[index].externalAddressId,
      scope: {
        type: 'TARIFF_CITY',
        tariffCityCode: input.tariffCityCode
      }
    });
  } catch (error) {
    throw addressRequestError(error, `pickupPoints.${index}.externalAddressId`);
  }
}

async function resolveFarmAddress(
  provider: ReturnType<typeof getLogisticsAddressProvider>,
  externalAddressId: string
) {
  try {
    return await resolveLogisticsAddress(provider, {
      externalAddressId,
      scope: { type: 'KAHARLYK_COMMUNITY' }
    });
  } catch (error) {
    throw addressRequestError(error, 'farmExternalAddressId');
  }
}

function addressSnapshot(
  address: LogisticsResolvedAddress
): {
  formattedAddress: string;
  externalAddressId: string;
  addressProvider: LogisticsAddressProviderKind;
  normalizedLocality: string;
  normalizedAdministrativeArea: string | null;
} {
  return {
    formattedAddress: address.formattedAddress,
    externalAddressId: address.externalAddressId,
    addressProvider: address.addressProvider,
    normalizedLocality: address.normalizedLocality,
    normalizedAdministrativeArea: address.normalizedAdministrativeArea ?? null
  };
}

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

  const tariff = await getActiveLogisticsTariff(input.parsed.tariffCityCode);
  const provider = getLogisticsAddressProvider();
  const pickupAddresses = await Promise.all(
    input.parsed.pickupPoints.map((_, index) =>
      resolvePickupAddress(provider, input.parsed, index)
    )
  );
  const farmAddress =
    input.parsed.destinationType === 'FARM' &&
    input.parsed.farmExternalAddressId
      ? await resolveFarmAddress(provider, input.parsed.farmExternalAddressId)
      : null;
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
    baseAddressSnapshot:
      input.parsed.destinationType === 'KAIROS_BASE'
        ? KAIROS_LOGISTICS_BASE_ADDRESS
        : null,
    farmAddress: farmAddress ? addressSnapshot(farmAddress) : null,
    pickupPoints: pickupAddresses.map((address, index) => ({
      ...addressSnapshot(address),
      cargoDescription: input.parsed.pickupPoints[index].cargoDescription
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

  return {
    requestNumber: result.requestNumber,
    totalPrice: serializeLogisticsMoney(result.totalPrice),
    currency: 'UAH' as const,
    vatIncluded: true as const,
    status: result.status
  };
}
