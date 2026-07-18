import 'server-only';

import { sendTelegramMessage } from '@/lib/telegram/bot';
import {
  buildUsedEquipmentInquiryManagerMessage,
  buildUsedEquipmentInquiryManagerUrl,
  type UsedEquipmentInquiryManagerNotificationContent
} from '@/lib/telegram/manager-notification-content';

export type UsedEquipmentInquiryManagerNotificationResult =
  | { status: 'sent' }
  | { status: 'skipped-no-manager-chat' }
  | { status: 'failed' };

type UsedEquipmentInquiryManagerNotificationInput = UsedEquipmentInquiryManagerNotificationContent & {
  inquiryId: string;
};

function safeErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 500) : 'Unknown error';
}

export async function notifyManagerAboutUsedEquipmentInquiry(
  input: UsedEquipmentInquiryManagerNotificationInput
): Promise<UsedEquipmentInquiryManagerNotificationResult> {
  const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID?.trim();

  if (!managerChatId) {
    console.info('Used equipment inquiry manager notification skipped', {
      event: 'usedEquipmentInquiryNotificationSkipped',
      inquiryId: input.inquiryId,
      hasManagerChat: false
    });

    return { status: 'skipped-no-manager-chat' };
  }

  try {
    await sendTelegramMessage(managerChatId, buildUsedEquipmentInquiryManagerMessage(input), {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: 'Відкрити заявку в CRM',
              url: buildUsedEquipmentInquiryManagerUrl(input.inquiryId)
            }
          ]
        ]
      }
    });

    return { status: 'sent' };
  } catch (error) {
    console.warn('Used equipment inquiry manager notification failed', {
      event: 'usedEquipmentInquiryNotificationFailed',
      inquiryId: input.inquiryId,
      hasManagerChat: true,
      error: safeErrorMessage(error)
    });

    return { status: 'failed' };
  }
}
