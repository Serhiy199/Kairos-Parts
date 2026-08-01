import { prisma } from '@/lib/prisma';
import { buildAbsoluteUrl } from '@/lib/site-url';
import { sendTelegramMessage, TelegramApiError } from '@/lib/telegram/bot';
import { resolveRequestItemsApprovalRecipient } from '@/lib/telegram/notifications';

export const CLIENT_REQUEST_NOTIFICATION_EVENTS = {
  WORK_STARTED: 'WORK_STARTED',
  CLIENT_SELECTION_APPROVED: 'CLIENT_SELECTION_APPROVED',
  CLIENT_SELECTION_REJECTED_ALL: 'CLIENT_SELECTION_REJECTED_ALL',
  AWAITING_SHIPMENT: 'AWAITING_SHIPMENT',
  COMPLETED: 'COMPLETED',
  CANCELLED_BY_MANAGER: 'CANCELLED_BY_MANAGER'
} as const;

export type ClientRequestNotificationEvent =
  (typeof CLIENT_REQUEST_NOTIFICATION_EVENTS)[keyof typeof CLIENT_REQUEST_NOTIFICATION_EVENTS];

export function buildClientRequestUrl(requestId: string) {
  return buildAbsoluteUrl(`/client/requests/${requestId}`);
}

export function buildClientRequestLifecycleMessage(
  event: ClientRequestNotificationEvent,
  requestNumber: string
) {
  const content: Record<ClientRequestNotificationEvent, [string, string]> = {
    WORK_STARTED: [
      'Заявку прийнято в роботу',
      'Менеджер розпочав підбір запчастин.'
    ],
    CLIENT_SELECTION_APPROVED: [
      'Ваше рішення отримано',
      'Погоджені позиції зафіксовано. Заявка перейшла до підготовки рахунку.'
    ],
    CLIENT_SELECTION_REJECTED_ALL: [
      'Заявку скасовано',
      'Ви не погодили жодної позиції актуального підбору.'
    ],
    AWAITING_SHIPMENT: [
      'Очікується відвантаження',
      'Замовлення готується до відвантаження.'
    ],
    COMPLETED: [
      'Заявку завершено',
      'Роботу із заявкою успішно завершено.'
    ],
    CANCELLED_BY_MANAGER: [
      'Заявку скасовано менеджером',
      'Менеджер припинив подальшу роботу із заявкою.'
    ]
  };
  const [stage, explanation] = content[event];
  return [
    `Заявка ${requestNumber}`,
    '',
    `Новий етап: ${stage}.`,
    explanation
  ].join('\n');
}

export type ClientLifecycleNotificationResult =
  | { status: 'sent'; notificationId: string }
  | { status: 'failed'; notificationId?: string }
  | { status: 'skipped-no-recipient' }
  | { status: 'skipped-request-not-found' };

async function executeRequestLifecycleNotification(
  requestId: string,
  event: ClientRequestNotificationEvent
): Promise<ClientLifecycleNotificationResult> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      client: { select: { userId: true, telegramChatId: true } },
      company: {
        select: {
          members: {
            orderBy: { createdAt: 'asc' },
            select: {
              isPrimaryContact: true,
              user: {
                select: {
                  id: true,
                  clientProfile: { select: { telegramChatId: true } }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!request) return { status: 'skipped-request-not-found' };

  const recipient = resolveRequestItemsApprovalRecipient(request);
  if (!recipient) return { status: 'skipped-no-recipient' };

  const message = buildClientRequestLifecycleMessage(event, request.requestNumber);
  let notificationId: string | undefined;
  try {
    const notification = await prisma.notification.create({
      data: {
        requestId: request.id,
        userId: recipient.userId,
        channel: 'TELEGRAM',
        status: 'PENDING',
        message
      }
    });
    notificationId = notification.id;
    await sendTelegramMessage(recipient.chatId, message, {
      replyMarkup: {
        inline_keyboard: [[{
          text: 'Відкрити заявку',
          url: buildClientRequestUrl(request.id)
        }]]
      }
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() }
    });
    return { status: 'sent', notificationId: notification.id };
  } catch (error) {
    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'FAILED' }
      }).catch((updateError) => {
        console.warn('Telegram notification persistence update failed.', {
          event,
          requestId,
          recipientType: 'CLIENT',
          errorCategory: updateError instanceof Error ? updateError.name : 'UNKNOWN'
        });
      });
    }
    console.warn('Client Telegram notification failed.', {
      event,
      requestId,
      recipientType: 'CLIENT',
      httpStatus: error instanceof TelegramApiError ? error.status : undefined,
      errorCategory: error instanceof Error ? error.name : 'UNKNOWN'
    });
    return { status: 'failed', notificationId };
  }
}

export async function notifyRequestLifecycleEvent(
  requestId: string,
  event: ClientRequestNotificationEvent
): Promise<ClientLifecycleNotificationResult> {
  try {
    return await executeRequestLifecycleNotification(requestId, event);
  } catch (error) {
    console.warn('Client Telegram notification failed before delivery.', {
      event,
      requestId,
      recipientType: 'CLIENT',
      httpStatus: error instanceof TelegramApiError ? error.status : undefined,
      errorCategory: error instanceof Error ? error.name : 'UNKNOWN'
    });
    return { status: 'failed' };
  }
}
