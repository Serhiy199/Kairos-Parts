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
  AUTH_ATTEMPT: 'Спроба входу',
  INVITATION: 'Запрошення',
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
  AUTH_LOGIN_SUCCEEDED: 'Вхід виконано',
  AUTH_LOGIN_FAILED: 'Невдала спроба входу',
  AUTH_LOGIN_BLOCKED_DISABLED: 'Вхід заблоковано: доступ вимкнено',
  AUTH_LOGIN_BLOCKED_PENDING: 'Вхід заблоковано: акаунт не активований',
  AUTH_LOGOUT: 'Вихід із системи',
  AUTH_INVITATION_ACCEPTED: 'Запрошення прийнято',
  AUTH_SESSION_INVALIDATED: 'Сесії анульовано',
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
  rejectedItemCount: 'Відхилено позицій',
  status: 'Статус',
  managerName: 'Менеджер',
  previousManagerName: 'Попередній менеджер',
  quantity: 'Кількість',
  unitPriceExVat: 'Ціна без ПДВ',
  totalExVat: 'Сума без ПДВ',
  vatAmount: 'Сума ПДВ',
  total: 'Усього',
  visibility: 'Видимість',
  fileName: 'Назва файлу',
  fileSize: 'Розмір файлу',
  size: 'Розмір файлу',
  documentType: 'Тип документа',
  companyName: 'Компанія',
  phone: 'Телефон',
  email: 'Email',
  iban: 'IBAN',
  requestId: 'ID заявки',
  requestNumber: 'Номер заявки',
  invoiceNumber: 'Номер рахунку',
  commercialOfferNumber: 'Номер пропозиції',
  currency: 'Валюта',
  paidAt: 'Дата оплати',
  sentAt: 'Дата надсилання',
  cancelledAt: 'Дата скасування',
  createdAt: 'Дата створення',
  updatedAt: 'Дата оновлення',
  mimeType: 'MIME-тип',
  oldStatus: 'Попередній статус',
  newStatus: 'Новий статус',
  clientVisible: 'Видимість клієнту'
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
  ACTIVE: 'Активний',
  INVITED: 'Очікує активації',
  DISABLED: 'Вимкнений',
  NEW: 'Нова заявка',
  IN_PROGRESS: 'Підбір у роботі',
  OFFER_PREPARING: 'Підбір у роботі',
  WAITING_APPROVAL: 'Очікує підтвердження',
  AWAITING_INVOICE: 'Очікує рахунок',
  INVOICE_SENT: 'Рахунок надісланий',
  AWAITING_SHIPMENT: 'Очікує на відвантаження',
  ORDERED: 'Очікує на відвантаження',
  IN_DELIVERY: 'Очікує на відвантаження',
  AWAITING_CLIENT: 'Очікує клієнта',
  COMPLETED: 'Завершено',
  CANCELLED: 'Скасовано',
  SENT: 'Надіслано',
  PAID: 'Оплачено',
  APPROVED: 'Погоджено',
  REJECTED: 'Відхилено',
  UAH: 'UAH',
  ADMIN_CRM: 'CRM адміністратора',
  CLIENT_CABINET: 'Кабінет клієнта',
  SYSTEM: 'Система',
  name: 'Назва техніки',
  equipmentType: 'Тип техніки',
  manufacturer: 'Виробник',
  model: 'Модель',
  year: 'Рік',
  vinOrSerial: 'VIN / серійний номер',
  comment: 'Коментар'
};

const FINANCIAL_KEYS = new Set([
  'unitPriceExVat',
  'totalExVat',
  'vatAmount',
  'total',
  'price',
  'amount'
]);

const DATE_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'sentAt',
  'paidAt',
  'cancelledAt',
  'expiresAt',
  'approvedAt',
  'rejectedAt'
]);

export function asAuditRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isSensitivePresentationKey(key: string) {
  const lowerKey = key.toLowerCase();
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
    'sessiontoken',
    'signedurl',
    'storagekey',
    'privateurl',
    'downloadurl'
  ]);

  return technicalKeys.has(lowerKey)
    || lowerKey.includes('token')
    || lowerKey.includes('secret')
    || lowerKey.includes('password');
}

export function auditFieldLabel(key: string) {
  const humanized = KEY_LABELS[key]
    ?? key.replace(/([a-zа-яіїєґ])([A-ZА-ЯІЇЄҐ])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return humanized ? humanized.charAt(0).toUpperCase() + humanized.slice(1) : 'Поле';
}

function formatDateValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('uk-UA');
}

function formatFinancialValue(value: unknown) {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(amount)) return null;

  return `${amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UAH`;
}

function shorten(value: string, maxLength = 320) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function formatAuditValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Так' : 'Ні';
  }

  if (typeof value === 'string') {
    if (key && FINANCIAL_KEYS.has(key)) {
      return formatFinancialValue(value) ?? shorten(value);
    }
    if (key && DATE_KEYS.has(key)) {
      return formatDateValue(value) ?? shorten(value);
    }
    return VALUE_LABELS[value] ?? shorten(value);
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    if (key && FINANCIAL_KEYS.has(key)) {
      return formatFinancialValue(value) ?? String(value);
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    const formatted = value.map((entry) => formatAuditValue(entry, key)).filter((entry) => entry !== '—');
    return formatted.length ? formatted.join(', ') : '—';
  }

  const record = asAuditRecord(value);
  if (!record) {
    return '—';
  }

  const parts = Object.entries(record)
    .filter(([entryKey]) => !isSensitivePresentationKey(entryKey))
    .map(([entryKey, entry]) => `${auditFieldLabel(entryKey)}: ${formatAuditValue(entry, entryKey)}`);

  return parts.length ? parts.join('; ') : '—';
}

export function formatAuditMetadata(metadata: unknown): AuditDetail[] {
  const record = asAuditRecord(metadata);
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .filter(([key]) => !isSensitivePresentationKey(key))
    .map(([key, value]) => ({
      key,
      label: auditFieldLabel(key),
      value: formatAuditValue(value, key)
    }))
    .filter((detail) => detail.value !== '—');
}

export function auditEventLabel(metadata: unknown) {
  const event = asAuditRecord(metadata)?.event;
  return typeof event === 'string' ? AUDIT_EVENT_LABELS[event] ?? event : null;
}

type AuditActorPresentation = {
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  actor: { name: string | null; email: string | null; role: string; status?: string } | null;
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
  const role = item.actorRole ?? item.actor?.role;
  return role ? VALUE_LABELS[role] ?? role : '—';
}

export function auditActorStatus(item: AuditActorPresentation) {
  const status = item.actor?.status;
  return status ? VALUE_LABELS[status] ?? status : null;
}

export function auditActionLabel(action: string, metadata?: unknown) {
  return auditEventLabel(metadata) ?? AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditCategoryLabel(category: string) {
  return AUDIT_CATEGORY_LABELS[category] ?? category;
}

export function auditEntityLabel(item: { entityType: string; entityId: string; entityLabel: string | null }) {
  if (item.entityLabel) return item.entityLabel;
  const type = AUDIT_ENTITY_LABELS[item.entityType] ?? item.entityType;
  const shortId = item.entityId.length > 12 ? `${item.entityId.slice(0, 12)}…` : item.entityId;
  return `${type} ${shortId}`;
}

export function auditEntityHref(item: {
  entityType: string;
  entityId: string;
  metadata: unknown;
}) {
  if (item.entityType === 'REQUEST') return `/admin/requests/${item.entityId}`;
  if (item.entityType === 'COMPANY') return `/admin/companies/${item.entityId}`;
  if (item.entityType === 'CLIENT') return `/admin/clients/${item.entityId}`;
  if (item.entityType === 'VEHICLE') return `/admin/vehicles/${item.entityId}/edit`;

  if (item.entityType === 'INVOICE' || item.entityType === 'COMMERCIAL_OFFER' || item.entityType === 'REQUEST_ITEM') {
    const requestId = asAuditRecord(item.metadata)?.requestId;
    return typeof requestId === 'string' && requestId.length <= 64
      ? `/admin/requests/${requestId}`
      : null;
  }

  return null;
}

export function formatAuditDateTime(value: Date) {
  return {
    date: value.toLocaleDateString('uk-UA'),
    time: value.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    full: value.toLocaleString('uk-UA')
  };
}

export type AuditValueRow = {
  key: string;
  label: string;
  value: string;
};

export function auditValueRows(value: unknown): AuditValueRow[] {
  const record = asAuditRecord(value);
  if (!record) {
    return value === null || value === undefined
      ? []
      : [{ key: 'value', label: 'Значення', value: formatAuditValue(value) }];
  }

  return Object.entries(record)
    .filter(([key]) => !isSensitivePresentationKey(key))
    .map(([key, entry]) => ({
      key,
      label: auditFieldLabel(key),
      value: formatAuditValue(entry, key)
    }));
}

export type AuditDiffRow = {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

export function auditDiffRows(oldValue: unknown, newValue: unknown): AuditDiffRow[] {
  const before = asAuditRecord(oldValue) ?? {};
  const after = asAuditRecord(newValue) ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => !isSensitivePresentationKey(key));

  if (!keys.length && (oldValue !== null || newValue !== null)) {
    const oldFormatted = formatAuditValue(oldValue);
    const newFormatted = formatAuditValue(newValue);
    return [{
      key: 'value',
      label: 'Значення',
      before: oldFormatted,
      after: newFormatted,
      changed: oldFormatted !== newFormatted
    }];
  }

  return keys.map((key) => {
    const oldFormatted = formatAuditValue(before[key], key);
    const newFormatted = formatAuditValue(after[key], key);
    return {
      key,
      label: auditFieldLabel(key),
      before: oldFormatted,
      after: newFormatted,
      changed: oldFormatted !== newFormatted
    };
  });
}
