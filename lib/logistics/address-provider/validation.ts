import type { LogisticsAddressScope } from '@/lib/logistics/address-provider/contracts';
import {
  invalidAddressRequest,
  LogisticsAddressError
} from '@/lib/logistics/address-provider/errors';
import {
  isLogisticsTariffCityCode,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';

export const LOGISTICS_ADDRESS_QUERY_MIN_LENGTH = 3;
export const LOGISTICS_ADDRESS_QUERY_MAX_LENGTH = 160;
export const LOGISTICS_EXTERNAL_ADDRESS_ID_MAX_LENGTH = 240;
export const LOGISTICS_ADDRESS_JSON_MAX_BYTES = 8 * 1024;
export const LOGISTICS_ADDRESS_SUGGESTION_LIMIT = 8;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseTariffCityCode(value: unknown): LogisticsTariffCityCode {
  if (typeof value !== 'string') {
    throw new LogisticsAddressError(
      'INVALID_ADDRESS_SCOPE',
      400,
      'Не вказано тарифне місто.'
    );
  }

  if (!isLogisticsTariffCityCode(value)) {
    throw new LogisticsAddressError(
      'UNKNOWN_TARIFF_CITY',
      400,
      'Невідоме тарифне місто.'
    );
  }

  return value;
}

export function parseLogisticsAddressScope(value: unknown): LogisticsAddressScope {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new LogisticsAddressError(
      'INVALID_ADDRESS_SCOPE',
      400,
      'Некоректна область пошуку адреси.'
    );
  }

  if (value.type === 'KAHARLYK_COMMUNITY') {
    return { type: 'KAHARLYK_COMMUNITY' };
  }

  if (value.type === 'TARIFF_CITY') {
    return {
      type: 'TARIFF_CITY',
      tariffCityCode: parseTariffCityCode(value.tariffCityCode)
    };
  }

  throw new LogisticsAddressError(
    'INVALID_ADDRESS_SCOPE',
    400,
    'Некоректна область пошуку адреси.'
  );
}

export function parseLogisticsAddressAutocompleteInput(value: unknown) {
  if (!isRecord(value) || typeof value.query !== 'string') {
    throw invalidAddressRequest();
  }

  const query = value.query.trim();

  if (query.length < LOGISTICS_ADDRESS_QUERY_MIN_LENGTH) {
    throw new LogisticsAddressError(
      'QUERY_TOO_SHORT',
      400,
      `Пошуковий запит має містити щонайменше ${LOGISTICS_ADDRESS_QUERY_MIN_LENGTH} символи.`
    );
  }

  if (query.length > LOGISTICS_ADDRESS_QUERY_MAX_LENGTH) {
    throw new LogisticsAddressError(
      'QUERY_TOO_LONG',
      400,
      `Пошуковий запит не може перевищувати ${LOGISTICS_ADDRESS_QUERY_MAX_LENGTH} символів.`
    );
  }

  return {
    query,
    scope: parseLogisticsAddressScope(value.scope)
  };
}

export function parseLogisticsAddressResolveInput(value: unknown) {
  if (!isRecord(value) || typeof value.externalAddressId !== 'string') {
    throw invalidAddressRequest();
  }

  const externalAddressId = value.externalAddressId.trim();

  if (
    !externalAddressId ||
    externalAddressId.length > LOGISTICS_EXTERNAL_ADDRESS_ID_MAX_LENGTH
  ) {
    throw invalidAddressRequest('Некоректний ідентифікатор адреси.');
  }

  return {
    externalAddressId,
    scope: parseLogisticsAddressScope(value.scope)
  };
}

export async function readBoundedLogisticsAddressJson(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  const mediaType = contentType.split(';', 1)[0]?.trim();

  if (mediaType !== 'application/json') {
    throw invalidAddressRequest('Очікується JSON-запит.');
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isFinite(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > LOGISTICS_ADDRESS_JSON_MAX_BYTES
    ) {
      throw invalidAddressRequest('Розмір запиту перевищує дозволений.');
    }
  }

  const rawBody = await request.text().catch(() => {
    throw invalidAddressRequest();
  });

  if (
    !rawBody ||
    new TextEncoder().encode(rawBody).byteLength > LOGISTICS_ADDRESS_JSON_MAX_BYTES
  ) {
    throw invalidAddressRequest('Некоректний або завеликий JSON-запит.');
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw invalidAddressRequest('Некоректний JSON-запит.');
  }
}
