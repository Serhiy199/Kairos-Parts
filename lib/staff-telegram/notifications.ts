import 'server-only';

import {
  buildNewLogisticsRequestMessage,
  buildNewPartsRequestMessage,
  type NewLogisticsRequestMessageInput,
  type NewPartsRequestMessageInput
} from '@/lib/staff-telegram/messages';
import {
  sendStaffTelegramMessage,
  type StaffTelegramSendInput,
  type StaffTelegramSendResult
} from '@/lib/staff-telegram/transport';
import { buildAbsoluteUrl } from '@/lib/site-url';

type StaffRequestEvent =
  | 'NEW_LOGISTICS_REQUEST'
  | 'NEW_PARTS_REQUEST';

const STAFF_CRM_BUTTON_TEXT = 'Відкрити заявку в CRM';

function buildTrustedCrmUrl(path: string) {
  const value = buildAbsoluteUrl(path);

  if (
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('Invalid staff CRM URL.');
  }

  const url = new URL(value);
  const trustedBase = new URL(buildAbsoluteUrl('/'));
  const isLocalDevelopmentUrl =
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

  if (
    (url.protocol !== 'https:' && !isLocalDevelopmentUrl) ||
    url.origin !== trustedBase.origin ||
    url.pathname !== path ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Invalid staff CRM URL.');
  }

  return url.toString();
}

function buildCrmButton(path: string) {
  return {
    text: STAFF_CRM_BUTTON_TEXT,
    url: buildTrustedCrmUrl(path)
  };
}

function logFailure(
  event: StaffRequestEvent,
  requestId: string,
  requestNumber: string,
  result: Exclude<
    StaffTelegramSendResult,
    { code: 'SENT' | 'SKIPPED_DISABLED' }
  >
) {
  console.error('Staff Telegram notification failed.', {
    event,
    requestId,
    requestNumber,
    code: result.code,
    httpStatus:
      'httpStatus' in result ? result.httpStatus : undefined,
    durationMs: result.durationMs
  });
}

async function notify(
  event: StaffRequestEvent,
  requestId: string,
  requestNumber: string,
  message: () => StaffTelegramSendInput
) {
  try {
    const result = await sendStaffTelegramMessage(message());
    if (result.code !== 'SENT' && result.code !== 'SKIPPED_DISABLED') {
      logFailure(event, requestId, requestNumber, result);
    }
  } catch {
    console.error('Staff Telegram notification failed.', {
      event,
      requestId,
      requestNumber,
      code: 'FAILED_UNEXPECTED'
    });
  }
}

export async function notifyNewLogisticsRequest(
  input: NewLogisticsRequestMessageInput & { id: string }
) {
  await notify(
    'NEW_LOGISTICS_REQUEST',
    input.id,
    input.requestNumber,
    () => ({
      text: buildNewLogisticsRequestMessage(input),
      button: buildCrmButton(
        `/admin/logistics/${encodeURIComponent(input.id)}`
      )
    })
  );
}

export async function notifyNewPartsRequest(
  input: NewPartsRequestMessageInput & {
    id: string;
  }
) {
  await notify(
    'NEW_PARTS_REQUEST',
    input.id,
    input.requestNumber,
    () => ({
      text: buildNewPartsRequestMessage(input),
      button: buildCrmButton(
        `/admin/requests/${encodeURIComponent(input.id)}`
      )
    })
  );
}
