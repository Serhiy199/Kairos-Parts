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
  COMMERCIAL_OFFER: 'Комерційна пропозиція',
  COMPANY: 'Компанія',
  CHANGE_REQUEST: 'Запит зміни',
  USER: 'Користувач',
  EQUIPMENT_TYPE: 'Тип техніки',
  MANUFACTURER: 'Виробник'
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CHANGE_REQUEST_CREATED: 'Запит створено',
  CHANGE_REQUEST_CANCELLED: 'Запит скасовано',
  CHANGE_REQUEST_APPROVED: 'Запит погоджено',
  CHANGE_REQUEST_REJECTED: 'Запит відхилено',
  CHANGE_APPLIED: 'Зміну застосовано',
  VEHICLE_ARCHIVED: 'Техніку архівовано',
  ENTITY_UPDATED: 'Об’єкт оновлено'
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
  MANUFACTURER_TYPES_CHANGED: 'Типи техніки виробника змінено'
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
  changedFields: 'Змінені поля'
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
  return key === 'id' || /(?:Id|Ids)$/.test(key);
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
