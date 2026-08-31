import { EQUIPMENT_TEXT_FIELD_MAX_LENGTH } from '@/lib/features/equipment-taxonomy';
import {
  MAX_REQUEST_FILES,
  MAX_REQUEST_FILE_TOTAL_BYTES
} from '@/lib/files/request-file-validation';
import { getUploadMaxSizeBytes, isAllowedUpload } from '@/lib/files/upload-policy';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
import { REQUEST_TEXT_LIMITS } from '@/lib/requests/limits';

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_IDENTITY_FIELDS = ['clientId', 'companyId', 'userId'] as const;

export type RequestSubmitMode = 'GUEST' | 'CLIENT';

export type ParsedRequestInput = {
  formType: 'detailed';
  idempotencyKey: string;
  vehicleId?: string;
  contactName: string;
  companyName: string | null;
  phone: string;
  email: string | null;
  description: string;
  equipmentType: string;
  manufacturer: string;
  model: string;
  vehicleYear: number;
  vinOrSerial: string;
  comment?: string;
  files: File[];
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSingleLine(value: string) {
  return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeMultiline(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim();
}

function readFiles(formData: FormData) {
  return formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function readVehicleYear(formData: FormData) {
  const rawValue = readString(formData, 'vehicleYear');
  if (!rawValue) return Number.NaN;
  const year = Number(rawValue);
  return Number.isInteger(year) ? year : Number.NaN;
}

function enforceMaxLength(errors: string[], value: string, maxLength: number, message: string) {
  if (value.length > maxLength) errors.push(message);
}

export function parseRequestFormData(
  formData: FormData,
  options: { mode: RequestSubmitMode }
): { data?: ParsedRequestInput; errors: string[] } {
  const errors: string[] = [];
  const idempotencyKey = readString(formData, 'idempotencyKey').toLowerCase();
  const vehicleId = readString(formData, 'vehicleId');
  const rawContactName = readString(formData, 'contactName');
  const rawCompanyName = readString(formData, 'companyName');
  const rawPhone = readString(formData, 'phone');
  const rawEmail = readString(formData, 'email');
  const contactName = options.mode === 'GUEST'
    ? normalizeSingleLine(rawContactName || rawCompanyName)
    : rawContactName || rawCompanyName;
  const companyName = options.mode === 'GUEST'
    ? normalizeSingleLine(rawCompanyName) || null
    : rawCompanyName || null;
  const normalizedGuestPhone = options.mode === 'GUEST'
    ? normalizeUkrainianPhone(rawPhone)
    : null;
  const phone = options.mode === 'GUEST' ? normalizedGuestPhone ?? '' : rawPhone;
  const email = rawEmail
    ? options.mode === 'GUEST'
      ? rawEmail.toLowerCase()
      : rawEmail
    : null;
  const description = normalizeMultiline(readString(formData, 'description'));
  const equipmentType = normalizeSingleLine(readString(formData, 'equipmentType'));
  const manufacturer = normalizeSingleLine(readString(formData, 'manufacturer'));
  const model = normalizeSingleLine(readString(formData, 'model'));
  const vehicleYear = readVehicleYear(formData);
  const vinOrSerial = normalizeSingleLine(readString(formData, 'vinOrSerial'));
  const comment = normalizeMultiline(readString(formData, 'comment'));
  const files = readFiles(formData);

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    errors.push('Не вдалося підтвердити спробу надсилання. Оновіть сторінку та повторіть.');
  }
  if (
    FORBIDDEN_IDENTITY_FIELDS.some((field) => formData.has(field))
    || (options.mode === 'GUEST' && vehicleId)
  ) {
    errors.push('Заявка містить недозволені ідентифікаційні дані.');
  }
  if (options.mode === 'GUEST' && readString(formData, 'website')) {
    errors.push('Не вдалося обробити запит.');
  }
  if (!contactName) errors.push('Вкажіть імʼя контактної особи.');
  if (options.mode === 'CLIENT' && !companyName) errors.push('Вкажіть назву компанії.');
  if (!rawPhone) {
    errors.push('Вкажіть телефон.');
  } else if (options.mode === 'GUEST' && !normalizedGuestPhone) {
    errors.push('Вкажіть український номер у форматі +380XXXXXXXXX.');
  }
  if (options.mode === 'CLIENT' && !email) {
    errors.push('Вкажіть email.');
  } else if (email && !EMAIL_PATTERN.test(email)) {
    errors.push('Вкажіть коректний email.');
  }

  enforceMaxLength(errors, contactName, REQUEST_TEXT_LIMITS.contactName, 'Імʼя контактної особи надто довге.');
  enforceMaxLength(errors, companyName ?? '', REQUEST_TEXT_LIMITS.companyName, 'Назва компанії надто довга.');
  enforceMaxLength(errors, rawPhone, REQUEST_TEXT_LIMITS.phone, 'Номер телефону надто довгий.');
  enforceMaxLength(errors, email ?? '', REQUEST_TEXT_LIMITS.email, 'Email надто довгий.');

  if (!equipmentType) {
    errors.push('Вкажіть тип техніки.');
  } else if (equipmentType.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    errors.push(`Тип техніки не може перевищувати ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`);
  }
  if (!manufacturer) {
    errors.push('Вкажіть виробника або марку техніки.');
  } else if (manufacturer.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    errors.push(`Виробник або марка не може перевищувати ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`);
  }
  if (!model) errors.push('Вкажіть модель техніки.');
  enforceMaxLength(errors, model, REQUEST_TEXT_LIMITS.model, 'Назва моделі надто довга.');
  if (Number.isNaN(vehicleYear) || vehicleYear < 1950 || vehicleYear > 2100) {
    errors.push('Вкажіть коректний рік випуску техніки.');
  }
  if (!vinOrSerial) errors.push('Вкажіть VIN або серійний номер техніки.');
  enforceMaxLength(errors, vinOrSerial, REQUEST_TEXT_LIMITS.vinOrSerial, 'VIN або серійний номер надто довгий.');
  if (!description) errors.push('Опишіть потребу або додайте коментар до заявки.');
  enforceMaxLength(errors, description, REQUEST_TEXT_LIMITS.description, 'Опис заявки надто довгий.');
  enforceMaxLength(errors, comment, REQUEST_TEXT_LIMITS.comment, 'Додатковий коментар надто довгий.');

  if (files.length > MAX_REQUEST_FILES) {
    errors.push(`До однієї заявки можна додати не більше ${MAX_REQUEST_FILES} файлів.`);
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_REQUEST_FILE_TOTAL_BYTES) {
    errors.push('Загальний розмір файлів заявки не може перевищувати 100 MB.');
  }
  const maxSizeBytes = getUploadMaxSizeBytes();
  for (const file of files) {
    if (!isAllowedUpload(file)) errors.push(`Файл "${file.name}" має непідтримуваний формат.`);
    if (file.size > maxSizeBytes) errors.push(`Файл "${file.name}" перевищує дозволений розмір.`);
  }

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    data: {
      formType: 'detailed',
      idempotencyKey,
      vehicleId: options.mode === 'CLIENT' && vehicleId ? vehicleId : undefined,
      contactName,
      companyName,
      phone,
      email,
      description,
      equipmentType,
      manufacturer,
      model,
      vehicleYear,
      vinOrSerial,
      comment: comment || undefined,
      files
    }
  };
}
