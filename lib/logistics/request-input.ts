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
  compareDateOnly,
  getKyivTodayDateOnly,
  parseDateOnly,
  type DateOnlyParseResult
} from '@/lib/logistics/date-only';
import {
  LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH,
  LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH,
  LOGISTICS_CLIENT_COMMENT_MAX_LENGTH,
  LOGISTICS_CONTACT_NAME_MAX_LENGTH,
  LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH,
  LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH,
  LOGISTICS_SUPPLIER_NAME_MAX_LENGTH,
  LOGISTICS_SUPPLIER_NAME_MIN_LENGTH
} from '@/lib/logistics/request-form-state';
import {
  isLogisticsPricingType,
  LOGISTICS_CUSTOM_LOCALITY_MAX_LENGTH,
  LOGISTICS_CUSTOM_LOCALITY_MIN_LENGTH,
  normalizeLogisticsCustomLocality
} from '@/lib/logistics/pricing-type';

export const LOGISTICS_QUOTE_JSON_MAX_BYTES = 4 * 1024;
export const LOGISTICS_CREATE_JSON_MAX_BYTES = 64 * 1024;
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type UnknownRecord = Record<string, unknown>;

export type LogisticsQuoteInput = {
  tariffCityCode: LogisticsTariffCityCode;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
};

type LogisticsCreateCommonInput = {
  idempotencyKey: string;
  honeypot: string;
  pickupPoints: Array<{
    supplierName: string;
    address: string;
    cargoDescription: string;
  }>;
  destinationType: LogisticsDestinationType;
  farmAddress: string | null;
  preferredDeliveryDate: DateOnlyParseResult;
  contactName: string;
  contactPhone: string;
  clientComment: string | null;
};

export type ParsedLogisticsPricingInput =
  | {
      pricingType: 'FIXED';
      tariffCityCode: LogisticsTariffCityCode;
      customLocality: null;
    }
  | {
      pricingType: 'INDIVIDUAL';
      tariffCityCode: null;
      customLocality: string;
    };

export type LogisticsCreateInput =
  LogisticsCreateCommonInput & ParsedLogisticsPricingInput;

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

function invalidPricingType() {
  return new LogisticsRequestError(
    'INVALID_PRICING_TYPE',
    422,
    'Оберіть тип розрахунку та заповніть відповідні дані.',
    'pricingType'
  );
}

function parseCreatePricing(value: UnknownRecord): ParsedLogisticsPricingInput {
  const rawPricingType = value.pricingType;
  const inferredLegacyFixed =
    rawPricingType === undefined &&
    typeof value.tariffCityCode === 'string' &&
    isLogisticsTariffCityCode(value.tariffCityCode);
  const pricingType = inferredLegacyFixed ? 'FIXED' : rawPricingType;

  if (typeof pricingType !== 'string' || !isLogisticsPricingType(pricingType)) {
    throw invalidPricingType();
  }

  if (pricingType === 'FIXED') {
    const customLocality =
      typeof value.customLocality === 'string'
        ? normalizeLogisticsCustomLocality(value.customLocality)
        : '';
    if (customLocality) throw invalidPricingType();

    return {
      pricingType: 'FIXED',
      tariffCityCode: parseTariffCityCode(value.tariffCityCode),
      customLocality: null
    };
  }

  if (value.tariffCityCode !== undefined && value.tariffCityCode !== null) {
    throw invalidPricingType();
  }
  if (typeof value.customLocality !== 'string') {
    throw new LogisticsRequestError(
      'INVALID_CUSTOM_LOCALITY',
      422,
      'Вкажіть населений пункт для індивідуального розрахунку.',
      'customLocality'
    );
  }

  const customLocality = normalizeLogisticsCustomLocality(
    value.customLocality
  );
  if (
    customLocality.length < LOGISTICS_CUSTOM_LOCALITY_MIN_LENGTH ||
    customLocality.length > LOGISTICS_CUSTOM_LOCALITY_MAX_LENGTH
  ) {
    throw new LogisticsRequestError(
      'INVALID_CUSTOM_LOCALITY',
      422,
      'Вкажіть населений пункт довжиною від 2 до 200 символів.',
      'customLocality'
    );
  }

  return {
    pricingType: 'INDIVIDUAL',
    tariffCityCode: null,
    customLocality
  };
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

function parsePreferredDeliveryDate(value: unknown) {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    throw new LogisticsRequestError(
      'INVALID_PREFERRED_DELIVERY_DATE',
      422,
      'Вкажіть коректну бажану дату перевезення.',
      'preferredDeliveryDate'
    );
  }
  if (compareDateOnly(parsed.value, getKyivTodayDateOnly()) < 0) {
    throw new LogisticsRequestError(
      'PREFERRED_DELIVERY_DATE_IN_PAST',
      422,
      'Бажана дата перевезення не може бути в минулому.',
      'preferredDeliveryDate'
    );
  }

  return parsed;
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
  minLength: number,
  maxLength: number,
  error: LogisticsRequestError,
  normalize: (value: string) => string = normalizeManualSingleLine
) {
  if (typeof value !== 'string') {
    throw error;
  }

  const normalized = normalize(value);
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw error;
  }

  return normalized;
}

export function normalizeManualSingleLine(value: string) {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function normalizeLogisticsCargoDescription(value: string) {
  return value
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(/[^\S\r\n]+/gu, ' ')
    .trim();
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
      supplierName: requiredBoundedString(
        point.supplierName,
        LOGISTICS_SUPPLIER_NAME_MIN_LENGTH,
        LOGISTICS_SUPPLIER_NAME_MAX_LENGTH,
        new LogisticsRequestError(
          'INVALID_PICKUP_POINTS',
          422,
          'Вкажіть назву компанії або постачальника.',
          `pickupPoints.${index}.supplierName`
        )
      ),
      address: requiredBoundedString(
        point.address,
        LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH,
        LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH,
        new LogisticsRequestError(
          'INVALID_PICKUP_POINTS',
          422,
          'Вкажіть повну адресу завантаження.',
          `pickupPoints.${index}.address`
        )
      ),
      cargoDescription: requiredBoundedString(
        point.cargoDescription,
        LOGISTICS_CARGO_DESCRIPTION_MIN_LENGTH,
        LOGISTICS_CARGO_DESCRIPTION_MAX_LENGTH,
        new LogisticsRequestError(
          'INVALID_PICKUP_POINTS',
          422,
          'Опишіть, що потрібно забрати.',
          `pickupPoints.${index}.cargoDescription`
        ),
        normalizeLogisticsCargoDescription
      )
    };
  });

  const destinationType = parseDestinationType(value.destinationType);
  const farmAddress =
    destinationType === 'FARM'
      ? requiredBoundedString(
          value.farmAddress,
          LOGISTICS_MANUAL_ADDRESS_MIN_LENGTH,
          LOGISTICS_MANUAL_ADDRESS_MAX_LENGTH,
          new LogisticsRequestError(
            'INVALID_DESTINATION',
            422,
            'Вкажіть повну адресу господарства.',
            'farmAddress'
          )
        )
      : null;
  const preferredDeliveryDate = parsePreferredDeliveryDate(
    value.preferredDeliveryDate
  );

  const contactName = requiredBoundedString(
    value.contactName,
    1,
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

  const pricing = parseCreatePricing(value);

  return {
    ...pricing,
    idempotencyKey,
    honeypot: '',
    pickupPoints,
    destinationType,
    farmAddress,
    preferredDeliveryDate,
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
