import { LogisticsAddressError } from '@/lib/logistics/address-provider/errors';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store'
} as const;

export function logisticsAddressJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: NO_STORE_HEADERS
  });
}

export function logisticsAddressErrorResponse(error: unknown) {
  const safeError =
    error instanceof LogisticsAddressError
      ? error
      : new LogisticsAddressError(
          'ADDRESS_PROVIDER_UNAVAILABLE',
          503,
          'Сервіс пошуку адрес тимчасово недоступний.'
        );

  return logisticsAddressJson(
    {
      error: {
        code: safeError.code,
        message: safeError.message
      }
    },
    safeError.status
  );
}
