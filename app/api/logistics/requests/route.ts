import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { resolveLogisticsSubmitIdentity } from '@/lib/logistics/access';
import {
  LOGISTICS_CREATE_JSON_MAX_BYTES,
  parseLogisticsCreateInput,
  readBoundedLogisticsJson
} from '@/lib/logistics/request-input';
import { LogisticsRequestError } from '@/lib/logistics/request-errors';
import {
  logisticsRequestErrorResponse,
  logisticsRequestJson
} from '@/lib/logistics/request-responses';
import {
  assertLogisticsSameOrigin,
  consumeLogisticsCreateRuntimeLimit
} from '@/lib/logistics/request-security';
import {
  createPreparedLogisticsRequest,
  prepareLogisticsRequest
} from '@/lib/logistics/request-service';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertLogisticsSameOrigin(request);
    const body = await readBoundedLogisticsJson(
      request,
      LOGISTICS_CREATE_JSON_MAX_BYTES
    );
    const parsed = parseLogisticsCreateInput(body);
    const identity = await resolveLogisticsSubmitIdentity();
    const normalizedPhone = normalizeUkrainianPhone(parsed.contactPhone);
    if (!normalizedPhone) {
      throw new LogisticsRequestError(
        'INVALID_CONTACT_PHONE',
        422,
        'Введіть український номер у форматі +380XXXXXXXXX.',
        'contactPhone'
      );
    }

    consumeLogisticsCreateRuntimeLimit({
      request,
      normalizedPhone,
      identity
    });
    const prepared = await prepareLogisticsRequest({
      parsed,
      identity,
      requestContext: auditRequestContextFromHeaders(request.headers)
    });
    const created = await createPreparedLogisticsRequest(prepared);

    return logisticsRequestJson({ request: created }, 201);
  } catch (error) {
    return logisticsRequestErrorResponse(error, 'REQUEST_CREATE_FAILED');
  }
}
