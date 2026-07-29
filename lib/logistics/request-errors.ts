export const LOGISTICS_REQUEST_ERROR_CODES = [
  'INVALID_REQUEST',
  'FORM_DISABLED',
  'SUBMIT_DISABLED',
  'STAFF_SUBMIT_FORBIDDEN',
  'INVALID_SESSION',
  'INVALID_CONTACT_NAME',
  'INVALID_CONTACT_PHONE',
  'INVALID_PICKUP_POINTS',
  'INVALID_DESTINATION',
  'UNKNOWN_TARIFF_CITY',
  'TARIFF_CITY_INACTIVE',
  'TARIFF_UNAVAILABLE',
  'ADDRESS_NOT_FOUND',
  'ADDRESS_SCOPE_MISMATCH',
  'ADDRESS_PROVIDER_DISABLED',
  'ADDRESS_PROVIDER_UNAVAILABLE',
  'INVALID_IDEMPOTENCY_KEY',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'QUOTE_UNAVAILABLE',
  'REQUEST_CREATE_FAILED'
] as const;

export type LogisticsRequestErrorCode =
  (typeof LOGISTICS_REQUEST_ERROR_CODES)[number];

export type LogisticsRequestErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

export class LogisticsRequestError extends Error {
  constructor(
    readonly code: LogisticsRequestErrorCode,
    readonly status: LogisticsRequestErrorStatus,
    message: string,
    readonly field?: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'LogisticsRequestError';
  }
}
export function invalidLogisticsRequest(
  message = 'Некоректний запит.',
  field?: string
) {
  return new LogisticsRequestError('INVALID_REQUEST', 400, message, field);
}
