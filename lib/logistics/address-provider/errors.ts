export const LOGISTICS_ADDRESS_ERROR_CODES = [
  'INVALID_REQUEST',
  'QUERY_TOO_SHORT',
  'QUERY_TOO_LONG',
  'INVALID_ADDRESS_SCOPE',
  'UNKNOWN_TARIFF_CITY',
  'ADDRESS_NOT_FOUND',
  'ADDRESS_SCOPE_MISMATCH',
  'ADDRESS_PROVIDER_DISABLED',
  'ADDRESS_PROVIDER_UNAVAILABLE'
] as const;

export type LogisticsAddressErrorCode = (typeof LOGISTICS_ADDRESS_ERROR_CODES)[number];

export class LogisticsAddressError extends Error {
  constructor(
    readonly code: LogisticsAddressErrorCode,
    readonly status: 400 | 404 | 422 | 503,
    message: string
  ) {
    super(message);
    this.name = 'LogisticsAddressError';
  }
}

export function invalidAddressRequest(message = 'Некоректний запит адреси.') {
  return new LogisticsAddressError('INVALID_REQUEST', 400, message);
}
