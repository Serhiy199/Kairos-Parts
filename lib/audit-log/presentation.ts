type AuditDetail = {
  key: string;
  label: string;
  value: string;
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  REQUEST: 'Заявка',
  REQUEST_ITEM: 'Позиція заявки',
  VEHICLE: 'Техніка',
  REQUEST_DOCUMENT: 'Документ заявки',
  DOCUMENT: 'Документ',
  COMMERCIAL_OFFER: 'Комерційна пропозиція',
  INVOICE: 'Рахунок',
  COMPANY: 'Компанія',
  CHANGE_REQUEST: 'Запит зміни',
  USER: 'Користувач',
  TEAM_MEMBER: 'Учасник команди',
  CLIENT: 'Клієнт',
  EQUIPMENT_TYPE: 'Тип техніки',
  MANUFACTURER: 'Виробник',
  AUTH_SESSION: 'Сесія',
  TELEGRAM_REQUEST: 'Telegram-заявка',
  SYSTEM: 'Система'
};

export const AUDIT_CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'Технічна',
  LOGIN: 'Вхід',
  CRITICAL_READ: 'Критичний перегляд',
  STANDARD: 'Стандартна',
  FINANCIAL_CRITICAL: 'Фінансово-критична'
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CHANGE_REQUEST_CREATED: 'Запит створено',
  CHANGE_REQUEST_CANCELLED: 'Запит скасовано',
  CHANGE_REQUEST_APPROVED: 'Запит погоджено',
  CHANGE_REQUEST_REJECTED: 'Запит відхилено',
  CHANGE_APPLIED: 'Зміну застосовано',
  VEHICLE_ARCHIVED: 'Техніку архівовано',
  ENTITY_UPDATED: 'Об’єкт оновлено',
  MANAGER_INVITATION_CREATED: 'Запрошення менеджера створено',
  MANAGER_INVITATION_REGENERATED: 'Запрошення менеджера оновлено',
  MANAGER_ACTIVATED: 'Менеджера активовано',
  MANAGER_DISABLED: 'Доступ менеджера вимкнено',
  MANAGER_ENABLED: 'Доступ менеджера увімкнено',
  REQUEST_STATUS_CHANGED: 'Статус заявки змінено',
  REQUEST_MANAGER_ASSIGNED: 'Менеджера призначено',
  REQUEST_MANAGER_REASSIGNED: 'Менеджера перепризначено',
  REQUEST_MANAGER_UNASSIGNED: 'Менеджера знято із заявки',
  REQUEST_COMPANY_CHANGED: 'Компанію заявки змінено',
  REQUEST_ITEM_CREATED: 'Позицію заявки створено',
  REQUEST_ITEM_UPDATED: 'Позицію заявки оновлено',
  REQUEST_ITEM_DELETED: 'Позицію заявки видалено',
  REQUEST_ITEMS_SENT_FOR_APPROVAL: 'Позиції надіслано на погодження',
  REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED: 'Вибір позицій клієнтом змінено',
  COMMERCIAL_OFFER_CREATED: 'Комерційну пропозицію створено',
  COMMERCIAL_OFFER_UPDATED: 'Комерційну пропозицію оновлено',
  COMMERCIAL_OFFER_ITEMS_CHANGED: 'Позиції комерційної пропозиції змінено',
  COMMERCIAL_OFFER_SENT: 'Комерційну пропозицію надіслано',
  COMMERCIAL_OFFER_APPROVED: 'Комерційну пропозицію погоджено',
  COMMERCIAL_OFFER_REJECTED: 'Комерційну пропозицію відхилено',
  COMMERCIAL_OFFER_CANCELLED: 'Комерційну пропозицію скасовано',
  COMMERCIAL_OFFER_DELETED: 'Комерційну пропозицію видалено',
  INVOICE_CREATED: 'Рахунок створено',
  INVOICE_SENT: 'Рахунок надіслано',
  INVOICE_MARKED_PAID: 'Рахунок позначено оплаченим',
  INVOICE_CANCELLED: 'Рахунок скасовано',
  INVOICE_PDF_OPENED: 'Друкований перегляд рахунку відкрито',
  DOCUMENT_UPLOADED: 'Документ завантажено',
  DOCUMENT_UPDATED: 'Документ оновлено',
  DOCUMENT_RENAMED: 'Документ перейменовано',
  DOCUMENT_VISIBILITY_CHANGED: 'Видимість документа змінено',
  DOCUMENT_DELETED: 'Документ видалено',
  DOCUMENT_DOWNLOADED: 'Документ завантажено користувачем',
  COMPANY_UPDATED: 'Компанію оновлено',
  COMPANY_BILLING_UPDATED: 'Реквізити компанії оновлено',
  COMPANY_PRIMARY_CONTACT_CHANGED: 'Основний контакт компанії змінено',
  COMPANY_MEMBER_ADDED: 'Учасника компанії додано',
  COMPANY_MEMBER_REMOVED: 'Учасника компанії видалено',
  CLIENT_BILLING_UPDATED: 'Реквізити клієнта оновлено'
};

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  VEHICLE_CREATED: 'Техніку створено',
  VEHICLE_UPDATED: 'Техніку оновлено',
  VEHICLE_IMAGE_UPLOADED: 'Фото техніки додано',
  VEHICLE_IMAGE_PRIMARY_CHANGED: 'Головне фото змінено',
  VEHICLE_IMAGES_REORDERED: 'Порядок фото змінено',
  VEHICLE_IMAGE_DELETED: 'Фото техніки видалено',
  VEHICLE_DOCUMENT_UPLOADED: 'Документ техніки додано',
  VEHICLE_DOCUMENT_VISIBILITY_CHANGED: 'Доступ до документа змінено',
  VEHICLE_DOCUMENT_DELETED: 'Документ техніки видалено',
  COMPANY_DOCUMENT_UPLOADED: 'Документ компанії додано',
  COMPANY_DOCUMENT_VISIBILITY_CHANGED: 'Доступ до документа компанії змінено',
  COMPANY_DOCUMENT_DELETED: 'Документ компанії видалено',
  CLIENT_DOCUMENT_UPLOADED: 'Документ клієнта додано',
  CLIENT_DOCUMENT_VISIBILITY_CHANGED: 'Доступ до документа клієнта змінено',
  CLIENT_DOCUMENT_DELETED: 'Документ клієнта видалено',
  CHANGE_REQUEST_CREATED: 'Запит на зміну створено',
  CHANGE_REQUEST_APPROVED: 'Запит на зміну погоджено',
  CHANGE_REQUEST_REJECTED: 'Запит на зміну відхилено',
  CHANGE_REQUEST_CANCELLED: 'Запит на зміну скасовано',
  EQUIPMENT_TYPE_CREATED: 'Тип техніки створено',
  EQUIPMENT_TYPE_UPDATED: 'Тип техніки оновлено',
  EQUIPMENT_TYPE_ACTIVATION_CHANGED: 'Активність типу техніки змінено',
  EQUIPMENT_TYPE_ORDER_CHANGED: 'Порядок типу техніки змінено',
  MANUFACTURER_CREATED: 'Виробника створено',
  MANUFACTURER_UPDATED: 'Виробника оновлено',
  MANUFACTURER_ACTIVATION_CHANGED: 'Активність виробника змінено',
  MANUFACTURER_ORDER_CHANGED: 'Порядок виробника змінено',
  MANUFACTURER_TYPES_CHANGED: 'Типи техніки виробника змінено',
  MANAGER_INVITATION_CREATED: 'Запрошення менеджера створено',
  MANAGER_INVITATION_REGENERATED: 'Запрошення менеджера оновлено',
  MANAGER_ACTIVATED: 'Менеджера активовано'
};

const KEY_LABELS: Record<string, string> = {
  event: 'Подія',
  action: 'Дія',
  reason: 'Причина',
  fieldName: 'Поле',
  entityType: 'Об’єкт',
  actorRole: 'Роль виконавця',
  ownerType: 'Тип власника',
  visibleToClient: 'Видимість клієнту',
  changedFields: 'Змінені поля',
  source: 'Джерело',
  itemCount: 'Кількість позицій',
  approvedItemCount: 'Погоджено позицій',
  rejectedItemCount: 'Відхилено позицій'
};

const VALUE_LABELS: Record<string, string> = {
  ...AUDIT_EVENT_LABELS,
  ...AUDIT_ACTION_LABELS,
  ADMIN: 'Адміністратор',
  MANAGER: 'Менеджер',
  CLIENT: 'Клієнт',
  client: 'Клієнт',
  company: 'Компанія',
  vehicle: 'Техніка',
  REQUEST: 'Заявка',
  VEHICLE: 'Техніка',
  UPDATE: 'Оновлення',
  CREATE: 'Створення',
  DELETE: 'Видалення',
  name: 'Назва техніки',
  equipmentType: 'Тип техніки',
  manufacturer: 'Виробник',
  model: 'Модель',
  year: 'Рік',
  vinOrSerial: 'VIN / серійний номер',
  comment: 'Коментар'
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isTechnicalIdKey(key: string) {
  const lowerKey = key.toLowerCase();
  if (key === 'id' || /(?:Id|Ids)$/.test(key)) {
    return true;
  }

  const technicalKeys = new Set([
    'password',
    'passwordhash',
    'token',
    'tokenhash',
    'authversion',
    'secret',
    'hash',
    'api_secret',
    'api_secret_key',
    'api_secret_key_hash',
    'webhook_secret',
    'bot_token',
    'sessionid',
    'useragent'
  ]);

  return technicalKeys.has(lowerKey);
}

function humanizeKey(key: string) {
  return KEY_LABELS[key] ?? key.replace(/([a-zа-яіїєґ])([A-ZА-ЯІЇЄҐ])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Так' : 'Ні';
  }

  if (typeof value === 'string') {
    return VALUE_LABELS[value] ?? value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const formatted = value.map(formatAuditValue).filter((entry) => entry !== '—');
    return formatted.length ? formatted.join(', ') : '—';
  }

  const record = asRecord(value);
  if (!record) {
    return '—';
  }

  const parts = Object.entries(record)
    .filter(([key]) => !isTechnicalIdKey(key))
    .map(([key, entry]) => `${humanizeKey(key)}: ${formatAuditValue(entry)}`);

  return parts.length ? parts.join('; ') : '—';
}

export function formatAuditMetadata(metadata: unknown): AuditDetail[] {
  const record = asRecord(metadata);
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .filter(([key]) => !isTechnicalIdKey(key))
    .map(([key, value]) => ({
      key,
      label: humanizeKey(key),
      value: formatAuditValue(value)
    }))
    .filter((detail) => detail.value !== '—');
}

export function auditEventLabel(metadata: unknown) {
  const event = asRecord(metadata)?.event;
  return typeof event === 'string' ? AUDIT_EVENT_LABELS[event] ?? event : null;
}

type AuditActorPresentation = {
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  actor: { name: string | null; email: string | null; role: string } | null;
};

export function auditActorLabel(item: AuditActorPresentation) {
  return item.actorName
    ?? item.actor?.name
    ?? item.actorEmail
    ?? 'Системна дія';
}

export function auditActorEmail(item: AuditActorPresentation) {
  return item.actorEmail ?? item.actor?.email ?? null;
}

export function auditActorRole(item: AuditActorPresentation) {
  return item.actorRole ?? item.actor?.role ?? '—';
}
