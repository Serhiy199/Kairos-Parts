import { RequestDocumentType } from '@prisma/client';

export const REQUEST_DOCUMENT_TYPE_LABELS: Record<RequestDocumentType, string> = {
  COMMERCIAL_OFFER: 'Комерційна пропозиція',
  INVOICE: 'Рахунок',
  SPECIFICATION: 'Специфікація',
  ACT: 'Акт',
  OTHER: 'Інше'
};

export const REQUEST_DOCUMENT_TYPES = Object.values(RequestDocumentType);

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png'
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png']);

export type RequestDocumentMetadataInput = {
  type: RequestDocumentType;
  title: string;
  visibleToClient: boolean;
};

export type RequestDocumentValidationResult =
  | { ok: true; data: RequestDocumentMetadataInput }
  | { ok: false; error: string };

function readString(source: FormData | Record<string, unknown>, key: string) {
  if (source instanceof FormData) {
    const value = source.get(key);
    return typeof value === 'string' ? value.trim() : '';
  }

  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(source: FormData | Record<string, unknown>, key: string) {
  if (source instanceof FormData) {
    return source.get(key) === 'on' || source.get(key) === 'true';
  }

  return source[key] === true || source[key] === 'true' || source[key] === 'on';
}

export function parseRequestDocumentMetadata(source: FormData | Record<string, unknown>): RequestDocumentValidationResult {
  const type = readString(source, 'type');
  const title = readString(source, 'title');

  if (!REQUEST_DOCUMENT_TYPES.includes(type as RequestDocumentType)) {
    return { ok: false, error: 'Оберіть тип документа.' };
  }

  if (!title) {
    return { ok: false, error: 'Назва документа є обовʼязковою.' };
  }

  return {
    ok: true,
    data: {
      type: type as RequestDocumentType,
      title,
      visibleToClient: readBoolean(source, 'visibleToClient')
    }
  };
}

export function readRequiredRequestDocumentFile(formData: FormData) {
  const value = formData.get('file');

  if (!(value instanceof File) || value.size === 0) {
    return { ok: false as const, error: 'Додайте файл документа.' };
  }

  if (value.size > MAX_DOCUMENT_SIZE) {
    return { ok: false as const, error: 'Файл завеликий. Максимальний розмір — 20 MB.' };
  }

  const extension = value.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeAllowed = value.type ? ALLOWED_MIME_TYPES.has(value.type) : false;

  if (!mimeAllowed && !ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false as const, error: 'Дозволені файли: PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG.' };
  }

  return { ok: true as const, file: value };
}
