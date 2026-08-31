import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { hasDatabaseUrl } from '@/lib/env/database';
import { createPartsRequest, RequestCreationError } from '@/lib/requests/create-request';
import { resolveRequestSubmitIdentity } from '@/lib/requests/identity';
import {
  assertPublicRequestBodyLength,
  assertPublicRequestOrigin,
  consumeGuestRequestIpLimit,
  consumeGuestRequestPhoneLimit,
  PublicRequestSecurityError,
  readBoundedPublicRequestFormData
} from '@/lib/requests/request-security';
import { parseRequestFormData } from '@/lib/requests/validation';

export function GET() {
  return Response.json(
    {
      status: 'not_implemented',
      contract: {
        module: 'requests',
        method: 'GET',
        path: '/api/requests',
        auth: 'manager-or-admin',
        summary: 'List requests for CRM-level workflows with future filters by status, source, manager, and date range.',
        response: { items: 'RequestListItem[]', pagination: '{ page, pageSize, total }' }
      }
    },
    { status: 501 }
  );
}

export const runtime = 'nodejs';

function securityErrorResponse(error: PublicRequestSecurityError) {
  return Response.json(
    { status: error.code.toLowerCase(), message: error.message },
    {
      status: error.statusCode,
      headers: error.retryAfterSeconds
        ? { 'Retry-After': String(error.retryAfterSeconds) }
        : undefined
    }
  );
}

export async function POST(request: Request) {
  try {
    assertPublicRequestOrigin(request);
    assertPublicRequestBodyLength(request);

    if (!hasDatabaseUrl()) {
      return Response.json(
        {
          status: 'database_not_configured',
          message: 'Зараз не вдалося створити заявку через налаштування сервера. Спробуйте пізніше або напишіть нам у Telegram.'
        },
        { status: 503 }
      );
    }

    const identityResult = await resolveRequestSubmitIdentity();
    if (!identityResult.ok) {
      const message = identityResult.status === 'forbidden'
        ? 'Створення заявки в цьому режимі недоступне для службового акаунта.'
        : identityResult.status === 'client_profile_not_found'
          ? 'Не вдалося знайти активний профіль клієнта.'
          : 'Сесію завершено. Оновіть сторінку та повторіть.';
      return Response.json({ status: identityResult.status, message }, { status: identityResult.statusCode });
    }

    const { identity } = identityResult;
    if (identity.type === 'GUEST') await consumeGuestRequestIpLimit(request);

    const formData = await readBoundedPublicRequestFormData(request);
    const parsed = parseRequestFormData(formData, { mode: identity.type });
    if (!parsed.data) {
      return Response.json(
        {
          status: 'validation_error',
          message: 'Перевірте обовʼязкові поля заявки.',
          errors: parsed.errors
        },
        { status: 400 }
      );
    }

    if (identity.type === 'GUEST') {
      await consumeGuestRequestPhoneLimit(parsed.data.phone);
    }

    const result = await createPartsRequest({
      identity,
      parsed: parsed.data,
      requestContext: auditRequestContextFromHeaders(request.headers)
    });
    const response = {
      requestNumber: result.request.requestNumber,
      status: result.request.status,
      duplicate: !result.createdNew,
      ...(identity.type === 'CLIENT'
        ? {
            id: result.request.id,
            publicStatusUrl: `/request/status/${result.request.publicStatusToken}`,
            files: result.request.files
          }
        : {})
    };
    return Response.json(response, { status: result.createdNew ? 201 : 200 });
  } catch (error) {
    if (error instanceof PublicRequestSecurityError) return securityErrorResponse(error);
    if (error instanceof RequestCreationError) {
      return Response.json(
        { status: error.code.toLowerCase(), message: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Request creation failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
    return Response.json(
      {
        status: 'request_create_failed',
        message: 'Не вдалося створити заявку. Спробуйте ще раз або напишіть нам у Telegram.'
      },
      { status: 503 }
    );
  }
}
