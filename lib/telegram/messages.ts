import type { TelegramDraftFile } from './types';

export const TELEGRAM_CALLBACKS = {
  confirm: 'telegram_request_confirm',
  cancel: 'telegram_request_cancel',
  restart: 'telegram_request_restart'
} as const;

export const contactKeyboard = {
  keyboard: [[{ text: 'Поділитися номером телефону', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true
};

export const removeKeyboard = {
  remove_keyboard: true
};

export const skipKeyboard = {
  keyboard: [[{ text: 'Пропустити' }]],
  resize_keyboard: true,
  one_time_keyboard: true
};

export const confirmationKeyboard = {
  inline_keyboard: [
    [{ text: 'Підтвердити заявку', callback_data: TELEGRAM_CALLBACKS.confirm }],
    [
      { text: 'Скасувати', callback_data: TELEGRAM_CALLBACKS.cancel },
      { text: 'Почати заново', callback_data: TELEGRAM_CALLBACKS.restart }
    ]
  ]
};

export const createdRequestKeyboard = {
  inline_keyboard: [[{ text: 'Створити ще одну заявку', callback_data: TELEGRAM_CALLBACKS.restart }]]
};

export function isSkipText(text: string) {
  return ['пропустити', 'skip', 'немає', 'нет', '-'].includes(text.trim().toLowerCase());
}

export function buildStartMessage() {
  return [
    'Вітаємо в Kairos Parts!',
    '',
    'Бот допоможе створити заявку на підбір запчастин для аграрної, вантажної або спеціальної техніки.',
    '',
    'Щоб почати, підтвердьте ваш номер телефону через кнопку нижче.'
  ].join('\n');
}

export function buildSummary(input: {
  contactName?: string | null;
  phone?: string | null;
  companyName?: string | null;
  equipmentType?: string | null;
  partsText?: string | null;
  description?: string | null;
  files: TelegramDraftFile[];
}) {
  return [
    'Перевірте заявку перед створенням:',
    '',
    `Імʼя: ${input.contactName || '—'}`,
    `Телефон: ${input.phone || '—'}`,
    `Компанія: ${input.companyName || '—'}`,
    `Тип техніки: ${input.equipmentType || '—'}`,
    `Запчастини / каталожні номери: ${input.partsText || 'не вказано'}`,
    `Опис потреби / коментар: ${input.description || 'не вказано'}`,
    `Файлів/фото: ${input.files.length}`,
    '',
    'Створити заявку в CRM?'
  ].join('\n');
}

export function buildCreatedMessage(input: { requestNumber: string; statusUrl: string }) {
  return [
    'Дякуємо! Вашу заявку створено.',
    '',
    `Номер заявки: ${input.requestNumber}`,
    '',
    'Статус заявки можна переглянути за посиланням:',
    input.statusUrl,
    '',
    'Менеджер Kairos Parts звʼяжеться з вами після обробки заявки.',
    '',
    'Щоб створити ще одну заявку, натисніть кнопку нижче або введіть /start.'
  ].join('\n');
}
