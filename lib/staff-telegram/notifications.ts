import 'server-only';

import type { LogisticsDestinationType } from '@prisma/client';

import {
  buildNewLogisticsRequestMessage,
  buildNewPartsRequestMessage
} from '@/lib/staff-telegram/messages';
import {
  sendStaffTelegramMessage,
  type StaffTelegramSendResult
} from '@/lib/staff-telegram/transport';

type StaffRequestEvent =
  | 'NEW_LOGISTICS_REQUEST'
  | 'NEW_PARTS_REQUEST';

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
  message: () => string
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

export async function notifyNewLogisticsRequest(input: {
  id: string;
  requestNumber: string;
  contactName: string;
  contactPhone: string;
  tariffCityName: string;
  pickupPointCount: number;
  destinationType: LogisticsDestinationType;
  preferredDeliveryDate: string | null;
  totalPrice: string;
}) {
  await notify(
    'NEW_LOGISTICS_REQUEST',
    input.id,
    input.requestNumber,
    () => buildNewLogisticsRequestMessage(input)
  );
}

export async function notifyNewPartsRequest(input: {
  id: string;
  requestNumber: string;
  companyName: string | null;
  contactName: string;
  contactPhone: string;
  itemCount?: number;
}) {
  await notify(
    'NEW_PARTS_REQUEST',
    input.id,
    input.requestNumber,
    () => buildNewPartsRequestMessage(input)
  );
}
