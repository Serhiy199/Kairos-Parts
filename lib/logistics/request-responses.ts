import {
  LogisticsRequestError,
  type LogisticsRequestErrorStatus
} from '@/lib/logistics/request-errors';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store'
} as const;

export function logisticsRequestJson(
  data: unknown,
  status: LogisticsRequestErrorStatus | 200 | 201 = 200,
  headers?: HeadersInit
) {
  return Response.json(data, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...headers
    }
  });
}
export function logisticsRequestErrorResponse(
  error: unknown,
  fallbackCode: 'QUOTE_UNAVAILABLE' | 'REQUEST_CREATE_FAILED'
) {
  const safeError =
    error instanceof LogisticsRequestError
      ? error
      : new LogisticsRequestError(
          fallbackCode,
          fallbackCode === 'QUOTE_UNAVAILABLE' ? 503 : 500,
          fallbackCode === 'QUOTE_UNAVAILABLE'
            ? 'Не вдалося перевірити тариф. Спробуйте ще раз.'
            : 'Не вдалося створити заявку. Спробуйте ще раз.'
        );

  return logisticsRequestJson(
    {
      error: {
        code: safeError.code,
        message: safeError.message,
        ...(safeError.field ? { field: safeError.field } : {})
      }
    },
    safeError.status,
    safeError.retryAfterSeconds
      ? { 'Retry-After': String(safeError.retryAfterSeconds) }
      : undefined
  );
}
