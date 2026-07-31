import path from 'node:path';

import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  getUploadMaxSizeBytes
} from '@/lib/files/upload-policy';

export const MAX_REQUEST_FILES = 10;
export const MAX_REQUEST_FILE_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_OCR_FILE_BYTES = 10 * 1024 * 1024;
export const OCR_COMPATIBLE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

export type OcrCompatibleMimeType = (typeof OCR_COMPATIBLE_MIME_TYPES)[number];

export type RequestFileBufferInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type ValidatedRequestFile = RequestFileBufferInput & {
  mimeType: (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];
  size: number;
};

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
} as const;

const DANGEROUS_INNER_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.cpl',
  '.exe',
  '.hta',
  '.html',
  '.htm',
  '.js',
  '.jar',
  '.lnk',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
  '.svg',
  '.vbs'
]);

function startsWith(bytes: Buffer, signature: readonly number[]) {
  return bytes.length >= signature.length
    && signature.every((value, index) => bytes[index] === value);
}

function hasExpectedSignature(mimeType: ValidatedRequestFile['mimeType'], bytes: Buffer) {
  if (mimeType === 'image/jpeg') {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mimeType === 'image/png') {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'application/pdf') {
    return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (
    mimeType === 'application/vnd.ms-excel'
    || mimeType === 'application/msword'
  ) {
    return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  }
  if (mimeType === 'text/csv') {
    if (bytes.includes(0)) return false;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 4096));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function hasDangerousDoubleExtension(fileName: string) {
  const parts = path.basename(fileName).toLowerCase().split('.');
  if (parts.length < 3) return false;
  return parts.slice(1, -1).some((part) => DANGEROUS_INNER_EXTENSIONS.has(`.${part}`));
}

export function normalizeRequestFileMime(fileName: string, declaredMimeType: string) {
  const extension = path.extname(fileName).toLowerCase() as keyof typeof MIME_BY_EXTENSION;
  const expectedMimeType = MIME_BY_EXTENSION[extension];
  const normalizedDeclared = declaredMimeType.trim().toLowerCase().split(';', 1)[0] ?? '';

  if (!expectedMimeType || !ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
    return null;
  }
  if (
    normalizedDeclared
    && normalizedDeclared !== expectedMimeType
    && !(extension === '.jpeg' && normalizedDeclared === 'image/jpeg')
  ) {
    return null;
  }
  return expectedMimeType;
}

export function validateRequestFileBuffer(
  input: RequestFileBufferInput
): { ok: true; file: ValidatedRequestFile } | { ok: false; code: string; message: string } {
  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > 255 || /[\u0000-\u001f\u007f]/.test(fileName)) {
    return { ok: false, code: 'INVALID_FILENAME', message: 'Некоректна назва файла.' };
  }
  if (hasDangerousDoubleExtension(fileName)) {
    return { ok: false, code: 'DANGEROUS_DOUBLE_EXTENSION', message: `Файл "${fileName}" має небезпечне подвійне розширення.` };
  }
  if (input.buffer.byteLength === 0) {
    return { ok: false, code: 'EMPTY_FILE', message: `Файл "${fileName}" порожній.` };
  }
  if (input.buffer.byteLength > getUploadMaxSizeBytes()) {
    return { ok: false, code: 'FILE_TOO_LARGE', message: `Файл "${fileName}" перевищує дозволений розмір.` };
  }

  const mimeType = normalizeRequestFileMime(fileName, input.mimeType);
  if (!mimeType || !ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType)) {
    return { ok: false, code: 'UNSUPPORTED_FILE_TYPE', message: `Файл "${fileName}" має непідтримуваний формат.` };
  }
  if (!hasExpectedSignature(mimeType, input.buffer)) {
    return { ok: false, code: 'FILE_SIGNATURE_MISMATCH', message: `Вміст файла "${fileName}" не відповідає його формату.` };
  }

  return {
    ok: true,
    file: {
      fileName,
      mimeType,
      buffer: input.buffer,
      size: input.buffer.byteLength
    }
  };
}

export function isOcrCompatibleMimeType(mimeType: string): mimeType is OcrCompatibleMimeType {
  return OCR_COMPATIBLE_MIME_TYPES.includes(mimeType as OcrCompatibleMimeType);
}

export function assertRequestFileQuota(input: {
  existingCount: number;
  existingBytes: number;
  files: readonly { size: number }[];
}) {
  const totalCount = input.existingCount + input.files.length;
  const totalBytes = input.existingBytes + input.files.reduce((sum, file) => sum + file.size, 0);
  if (totalCount > MAX_REQUEST_FILES) {
    throw new Error(`До однієї заявки можна додати не більше ${MAX_REQUEST_FILES} файлів.`);
  }
  if (totalBytes > MAX_REQUEST_FILE_TOTAL_BYTES) {
    throw new Error('Загальний розмір файлів заявки не може перевищувати 100 MB.');
  }
}
