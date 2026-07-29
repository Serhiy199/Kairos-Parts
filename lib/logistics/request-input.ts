import type { LogisticsDestinationType } from '@prisma/client';

import { LOGISTICS_PICKUP_POINT_TECHNICAL_LIMIT } from '@/lib/logistics/constants';
import {
  invalidLogisticsRequest,
  LogisticsRequestError
} from '@/lib/logistics/request-errors';
import {
  isLogisticsTariffCityCode,
  type LogisticsTariffCityCode
} from '@/lib/logistics/tariff-cities';
import {
  LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH,
  LOGISTICS_CLIENT_COMMENT_MAX_LENGTH,
  LOGISTICS_CONTACT_NAME_MAX_LENGTH
} from '@/lib/logistics/request-form-state';

export const LOGISTICS_QUOTE_JSON_MAX_BYTES = 4 * 1024;
export const LOGISTICS_CREATE_JSON_MAX_BYTES = 64 * 1024;
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTERNAL_ADDRESS_ID_MAX_LENGTH = 240;

type UnknownRecord = Record<string, unknown>;

export type LogisticsQuoteInput = {
  tariffCityCode: LogisticsTariffCityCode;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
};

export type LogisticsCreateInput = {
  idempotencyKey: string;
  honeypot: string;
  tariffCityCode: LogisticsTariffCityCode;
  pickupPoints: Array<{
    externalAddressId: string;
    cargoDescription: string;
  }>;
  destinationType: LogisticsDestinationType;
  farmExternalAddressId: string | null;
  contactName: string;
  contactPhone: string;
  clientComment: string | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function parseTariffCityCode(value: unknown) {
  if (typeof value !== 'string' || !isLogisticsTariffCityCode(value)) {
    throw new LogisticsRequestError(
      'UNKNOWN_TARIFF_CITY',
      422,
      'Оберіть доступне тарифне місто.',
      'tariffCityCode'
    );
  }

  return value;
}

function parseDestinationType(value: unknown): LogisticsDestinationType {
  if (value !== 'KAIROS_BASE' && value !== 'FARM') {
    throw new LogisticsRequestError(
      'INVALID_DESTINATION',
      422,
      'Оберіть місце доставки.',
      'destinationType'
    );
  }

  return value;
}

function parsePickupPointCount(value: unknown) {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > LOGISTICS_PICKUP_POINT_TECHNICAL_LIMIT
  ) {
    throw new LogisticsRequestError(
      'INVALID_PICKUP_POINTS',
      422,
      'Некоректна кількість точок відвантаження.',
      'pickupPoints'
    );
  }

  return value as number;
}

function requiredBoundedString(
  value: unknown,
  maxLength: number,
  error: LogisticsRequestError
) {
  if (typeof value !== 'string') {
    throw error;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw error;
  }

  return normalized;
}

export function parseLogisticsQuoteInput(value: unknown): LogisticsQuoteInput {
  if (!isRecord(value)) {
    throw invalidLogisticsRequest();
  }

  return {
    tariffCityCode: parseTariffCityCode(value.tariffCityCode),
    pickupPointCount: parsePickupPointCount(value.pickupPointCount),
    destinationType: parseDestinationType(value.destinationType)
  };
}

export function parseLogisticsCreateInput(value: unknown): LogisticsCreateInput {
  if (!isRecord(value)) {
    throw invalidLogisticsRequest();
  }

  const idempotencyKey =
    typeof value.idempotencyKey === 'string'
      ? value.idempotencyKey.trim().toLowerCase()
      : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new LogisticsRequestError(
      'INVALID_IDEMPOTENCY_KEY',
      400,
      'Не вдалося підтвердити спробу надсилання.'
    );
  }

  const honeypot =
    typeof value.honeypot === 'string' ? value.honeypot.trim().slice(0, 200) : '';
  if (honeypot) {
    throw invalidLogisticsRequest('Не вдалося обробити запит.');
  }

  if (!Array.isArray(value.pickupPoints)) {
    throw new LogisticsRequestError(
      'INVALID_PICKUP_POINTS',
      422,
      'Додайте хоча б одну точку відвантаження.',
      'pickupPoints'
    );
  }

  parsePickupPointCount(value.pickupPoints.length);
  const pickupPoints = value.pickupPoints.map((point, index) => {
    if (!isRecord(point)) {
      throw new LogisticsRequestError(
        'INVALID_PICKUP_POINTS',
        422,
        'Перевірте точки відвантаження.',
        `pickupPoints.${index}`
      );
    }

    return {
      externalAddressId: requiredBoundedString(
        point.externalAddressId,
        EXTERNAL_ADDRESS_ID_MAX_LENGTH,
        new LogisticsRequestError(
          'INVALID_PICKUP_POINTS',
          422,
          'Повторно оберіть адресу зі списку.',
          `pickupPoints.${index}.externalAddressId`
        )
      ),
      cargoDescription: requiredBoundedString(
        point.cargoDescription,
        LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH,
        new LogisticsRequestError(
          'INVALID_PICKUP_POINTS',
          422,
          'Опишіть, що потрібно забрати.',
          `pickupPoints.${index}.cargoDescription`
        )
      )
    };
  });

  const destinationType = parseDestinationType(value.destinationType);
  const farmExternalAddressId =
    destinationType === 'FARM'
      ? requiredBoundedString(
          value.farmExternalAddressId,
          EXTERNAL_ADDRESS_ID_MAX_LENGTH,
          new LogisticsRequestError(
            'INVALID_DESTINATION',
            422,
            'Оберіть адресу господарства зі списку.',
            'farmExternalAddressId'
          )
        )
      : null;

  const contactName = requiredBoundedString(
    value.contactName,
    LOGISTICS_CONTACT_NAME_MAX_LENGTH,
    new LogisticsRequestError(
      'INVALID_CONTACT_NAME',
      422,
      'Вкажіть контактне ім’я.',
      'contactName'
    )
  );
  const contactPhone =
    typeof value.contactPhone === 'string' ? value.contactPhone.trim() : '';
  if (!contactPhone || contactPhone.length > 40) {
    throw new LogisticsRequestError(
      'INVALID_CONTACT_PHONE',
      422,
      'Введіть коректний український номер телефону.',
      'contactPhone'
    );
  }

  const rawComment =
    typeof value.clientComment === 'string' ? value.clientComment.trim() : '';
  if (rawComment.length > LOGISTICS_CLIENT_COMMENT_MAX_LENGTH) {
    throw new LogisticsRequestError(
      'INVALID_REQUEST',
      422,
      'Коментар занадто довгий.',
      'clientComment'
    );
  }

  return {
    idempotencyKey,
    honeypot: '',
    tariffCityCode: parseTariffCityCode(value.tariffCityCode),
    pickupPoints,
    destinationType,
    farmExternalAddressId,
    contactName,
    contactPhone,
    clientComment: rawComment || null
  };
}

export async function readBoundedLogisticsJson(
  request: Request,
  maxBytes: number
) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.split(';', 1)[0]?.trim() !== 'application/json') {
    throw invalidLogisticsRequest('Очікується JSON-запит.');
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isFinite(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > maxBytes
    ) {
      throw invalidLogisticsRequest('Розмір запиту перевищує дозволений.');
    }
  }

  const rawBody = await request.text().catch(() => {
    throw invalidLogisticsRequest();
  });
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    throw invalidLogisticsRequest('Некоректний або завеликий JSON-запит.');
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw invalidLogisticsRequest('Некоректний JSON-запит.');
  }
}
