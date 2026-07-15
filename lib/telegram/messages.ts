import type { TelegramDraftFile } from './types';

export const TELEGRAM_CALLBACKS = {
  continueRequest: 'telegram_request_continue',
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

export const equipmentTypeKeyboard = {
  keyboard: [
    [{ text: 'Комбайн' }, { text: 'Трактори' }],
    [{ text: 'Вантажний транспорт' }, { text: 'Причіп / напівпричіп' }],
    [{ text: 'Будівельна техніка' }, { text: 'Спеціальна техніка' }],
    [{ text: 'Інше' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

export const continueRequestKeyboard = {
  inline_keyboard: [[{ text: 'Продовжити створення заявки', callback_data: TELEGRAM_CALLBACKS.continueRequest }]]
};

export const confirmationKeyboard = {
  inline_keyboard: [
    [{ text: 'Створити заявку', callback_data: TELEGRAM_CALLBACKS.confirm }],
    [
      { text: 'Скасувати', callback_data: TELEGRAM_CALLBACKS.cancel },
      { text: 'Почати заново', callback_data: TELEGRAM_CALLBACKS.restart }
    ]
  ]
};

export const createdRequestKeyboard = {
  inline_keyboard: [[{ text: 'Створити ще одну заявку', callback_data: TELEGRAM_CALLBACKS.restart }]]
};

export function buildRegistrationKeyboard(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return {
    inline_keyboard: [
      [
        { text: 'Зареєструватися', url: `${normalizedBaseUrl}/register?next=/request` },
        { text: 'Увійти', url: `${normalizedBaseUrl}/login?next=/request` }
      ]
    ]
  };
}

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

export function buildProfileFoundMessage(input: {
  contactName?: string | null;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  return [
    'Ми знайшли ваш клієнтський кабінет Kairos Parts.',
    '',
    'Заявка буде створена від імені:',
    `Контакт: ${input.contactName || '—'}`,
    `Компанія: ${input.companyName || '—'}`,
    `Телефон: ${input.phone || '—'}`,
    `Email: ${input.email || '—'}`,
    '',
    'Продовжити створення заявки?'
  ].join('\n');
}

export function buildRegistrationRequiredMessage() {
  return [
    'Ми не знайшли клієнтський кабінет із цим номером телефону.',
    '',
    'Щоб створити заявку через Telegram, спочатку зареєструйтеся або увійдіть у кабінет Kairos Parts.'
  ].join('\n');
}

export function buildSummary(input: {
  contactName?: string | null;
  phone?: string | null;
  companyName?: string | null;
  email?: string | null;
  equipmentType?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  vehicleYear?: number | null;
  vinOrSerial?: string | null;
  description?: string | null;
  extraComment?: string | null;
  files: TelegramDraftFile[];
}) {
  const fileNames = input.files.length ? input.files.map((file) => `- ${file.fileName}`).join('\n') : 'не додано';

  return [
    'Перевірте заявку перед створенням:',
    '',
    `Контакт: ${input.contactName || '—'}`,
    `Компанія: ${input.companyName || '—'}`,
    `Телефон: ${input.phone || '—'}`,
    `Email: ${input.email || '—'}`,
    '',
    `Тип техніки: ${input.equipmentType || '—'}`,
    `Виробник / марка: ${input.manufacturer || '—'}`,
    `Модель: ${input.model || '—'}`,
    `Рік випуску: ${input.vehicleYear ?? '—'}`,
    `VIN / серійний номер: ${input.vinOrSerial || '—'}`,
    '',
    'Опис / коментар:',
    input.description || '—',
    '',
    'Додатковий коментар:',
    input.extraComment || '—',
    '',
    'Файл:',
    fileNames,
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
