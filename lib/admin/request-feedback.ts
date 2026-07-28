export type AdminActionFeedbackTone = 'success' | 'warning' | 'error';

export type AdminActionFeedback = {
  tone: AdminActionFeedbackTone;
  marker: 'Успішно' | 'Увага' | 'Помилка';
  message: string;
  className: string;
};

const tonePresentation = {
  success: {
    marker: 'Успішно',
    className: 'border-success/30 bg-[#E7F6EC] text-success'
  },
  warning: {
    marker: 'Увага',
    className: 'border-accent/40 bg-[#FFF7E0] text-[#8A5B24]'
  },
  error: {
    marker: 'Помилка',
    className: 'border-danger/30 bg-danger/10 text-danger'
  }
} as const satisfies Record<
  AdminActionFeedbackTone,
  Pick<AdminActionFeedback, 'marker' | 'className'>
>;

const feedbackByResult = {
  'status-updated': { tone: 'success', message: 'Статус оновлено.' },
  assigned: { tone: 'success', message: 'Відповідального менеджера оновлено.' },
  'comment-added': { tone: 'success', message: 'Внутрішній коментар додано.' },
  'admin-only': { tone: 'warning', message: 'Призначати менеджера може тільки ADMIN.' },
  'status-error': { tone: 'error', message: 'Не вдалося оновити статус.' },
  'ocr-created': { tone: 'success', message: 'OCR виконано. Перевірте результат нижче.' },
  'ocr-corrected': { tone: 'success', message: 'OCR-текст оновлено.' },
  'ocr-error': { tone: 'error', message: 'Не вдалося запустити OCR.' },
  'ocr-correction-error': { tone: 'error', message: 'Не вдалося зберегти OCR-корекцію.' },
  'assign-error': { tone: 'error', message: 'Не вдалося призначити менеджера.' },
  'comment-error': { tone: 'warning', message: 'Коментар не може бути порожнім.' },
  'manager-not-found': { tone: 'warning', message: 'Менеджера не знайдено.' },
  'item-created': { tone: 'success', message: 'Позицію додано.' },
  'item-updated': { tone: 'success', message: 'Позицію оновлено.' },
  'item-no-changes': { tone: 'warning', message: 'Змін у позиції не виявлено.' },
  'item-validation-error': { tone: 'error', message: 'Перевірте введені дані позиції.' },
  'item-stale': {
    tone: 'warning',
    message: 'Позицію вже було змінено. Оновіть сторінку та повторіть редагування.'
  },
  'item-update-error': {
    tone: 'error',
    message: 'Не вдалося оновити позицію. Спробуйте ще раз.'
  },
  'item-deleted': { tone: 'success', message: 'Позицію видалено.' },
  'items-sent-for-approval': {
    tone: 'success',
    message: 'Позиції надіслано клієнту на погодження.'
  },
  'items-sent-for-approval-notification-failed': {
    tone: 'warning',
    message: 'Позиції надіслано в кабінет клієнта, але Telegram-повідомлення не доставлено.'
  },
  'items-send-empty': {
    tone: 'warning',
    message: 'Немає нових позицій для відправлення на погодження.'
  },
  'items-send-stale': {
    tone: 'warning',
    message: 'Позиції змінилися після відкриття сторінки. Оновіть сторінку та перевірте добірку.'
  },
  'items-send-duplicate': {
    tone: 'warning',
    message: 'Цю добірку вже відправлено на погодження.'
  },
  'items-send-status-locked': {
    tone: 'warning',
    message: 'Поточний статус заявки не дозволяє відправити добірку на погодження.'
  },
  'items-send-error': {
    tone: 'error',
    message: 'Не вдалося відправити позиції на погодження. Спробуйте ще раз.'
  },
  'item-error': { tone: 'warning', message: 'Перевірте дані позиції.' },
  'item-status-locked': {
    tone: 'warning',
    message: 'Не можна додавати позиції до виконаної або скасованої заявки.'
  },
  'item-not-found': { tone: 'warning', message: 'Позицію не знайдено.' },
  'document-created': { tone: 'success', message: 'Документ додано.' },
  'document-updated': { tone: 'success', message: 'Документ оновлено.' },
  'document-deleted': { tone: 'success', message: 'Документ видалено.' },
  'document-error': { tone: 'warning', message: 'Перевірте дані документа.' },
  'document-not-found': { tone: 'warning', message: 'Документ не знайдено.' },
  'invoice-created': { tone: 'success', message: 'Рахунок створено.' },
  'invoice-sent': { tone: 'success', message: 'Рахунок надіслано клієнту.' },
  'invoice-cancelled': { tone: 'success', message: 'Рахунок скасовано.' },
  'invoice-paid': { tone: 'success', message: 'Рахунок позначено як оплачений.' },
  'invoice-no-approved-items': {
    tone: 'warning',
    message: 'Немає погоджених позицій для створення рахунку.'
  },
  'invoice-request-not-awaiting': {
    tone: 'warning',
    message: 'Статус заявки ще не дозволяє створити рахунок.'
  },
  'invoice-selection-not-found': {
    tone: 'warning',
    message: 'Не знайдено завершеної версії підбору для рахунку.'
  },
  'invoice-selection-stale': {
    tone: 'warning',
    message: 'Версія підбору неактуальна або ще очікує рішення клієнта.'
  },
  'invoice-approved-price-missing': {
    tone: 'warning',
    message: 'Для погодженої позиції не вказано ціну.'
  },
  'invoice-currency-mismatch': {
    tone: 'warning',
    message: 'Погоджені позиції мають різні валюти.'
  },
  'invoice-selection-already-invoiced': {
    tone: 'warning',
    message: 'Для цієї версії підбору рахунок уже створено.'
  },
  'invoice-not-found': { tone: 'warning', message: 'Рахунок не знайдено.' },
  'invoice-invalid-transition': {
    tone: 'warning',
    message: 'Некоректна зміна статусу рахунку.'
  },
  'invoice-empty': { tone: 'warning', message: 'Не можна надіслати порожній рахунок.' },
  'invoice-forbidden': {
    tone: 'warning',
    message: 'Недостатньо прав для роботи з рахунком.'
  },
  'invoice-seller-details-required': {
    tone: 'warning',
    message: 'Спочатку заповніть реквізити продавця.'
  },
  'invoice-error': { tone: 'error', message: 'Не вдалося обробити рахунок.' }
} as const satisfies Record<string, { tone: AdminActionFeedbackTone; message: string }>;

export function getAdminRequestFeedback(result?: string): AdminActionFeedback | null {
  if (!result || !Object.prototype.hasOwnProperty.call(feedbackByResult, result)) {
    return null;
  }

  const feedback = feedbackByResult[result as keyof typeof feedbackByResult];
  return {
    ...feedback,
    ...tonePresentation[feedback.tone]
  };
}
