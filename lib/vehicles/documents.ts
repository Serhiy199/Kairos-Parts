export const MAX_VEHICLE_DOCUMENTS = 25;
export const MAX_VEHICLE_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const MAX_VEHICLE_DOCUMENT_BATCH_FILES = 5;
export const MAX_VEHICLE_DOCUMENT_BATCH_BYTES = 60 * 1024 * 1024;
export const MAX_VEHICLE_DOCUMENT_TOTAL_BYTES = 250 * 1024 * 1024;
export const MAX_VEHICLE_DOCUMENT_FILENAME_LENGTH = 255;
export const MAX_DOCUMENTS_PER_OWNER = MAX_VEHICLE_DOCUMENTS;
export const MAX_DOCUMENT_BYTES = MAX_VEHICLE_DOCUMENT_BYTES;

const VEHICLE_DOCUMENT_EXTENSIONS_BY_MIME = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp']
} as const;

const BLOCKED_SECONDARY_EXTENSIONS = new Set([
  'bat', 'cmd', 'com', 'exe', 'html', 'htm', 'js', 'jar', 'msi', 'ps1',
  'scr', 'sh', 'svg', 'tar', 'zip', '7z', 'rar'
]);

export type VehicleDocumentValidationCode =
  | 'DOCUMENT_NOT_SELECTED'
  | 'DOCUMENT_EMPTY'
  | 'DOCUMENT_TYPE_NOT_ALLOWED'
  | 'DOCUMENT_EXTENSION_MISMATCH'
  | 'DOCUMENT_SIGNATURE_INVALID'
  | 'DOCUMENT_TOO_LARGE'
  | 'DOCUMENT_COUNT_LIMIT_REACHED'
  | 'DOCUMENT_BATCH_LIMIT_REACHED'
  | 'DOCUMENT_BATCH_SIZE_LIMIT_REACHED'
  | 'DOCUMENT_FILENAME_INVALID';

export type VehicleDocumentActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const EMPTY_VEHICLE_DOCUMENT_ACTION_STATE: VehicleDocumentActionState = { status: 'idle' };

export function getVehicleDocumentFiles(formData: FormData) {
  return formData.getAll('documents').filter((value): value is File => value instanceof File);
}

function normalizedMimeType(file: File) {
  return file.type.trim().toLowerCase().split(';', 1)[0] ?? '';
}

export function vehicleDocumentExtensionForMime(mimeType: string) {
  const extensions = VEHICLE_DOCUMENT_EXTENSIONS_BY_MIME[
    mimeType as keyof typeof VEHICLE_DOCUMENT_EXTENSIONS_BY_MIME
  ];
  return extensions?.[0] ?? null;
}

function fileExtension(fileName: string) {
  const leaf = fileName.split(/[\\/]/).pop() ?? '';
  const parts = leaf.toLowerCase().split('.');
  if (parts.length < 2 || !parts.at(-1)) return null;
  return {
    extension: parts.at(-1) as string,
    secondaryExtensions: parts.slice(1, -1)
  };
}

function hasExpectedSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === 'application/pdf') {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  }

  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }

  return false;
}

function validationError(code: VehicleDocumentValidationCode, message: string) {
  return { ok: false as const, code, message };
}

export async function validateVehicleDocumentFiles(
  files: File[],
  existingCount: number,
  ownerLabel = 'однієї одиниці техніки'
) {
  if (files.length === 0) {
    return validationError('DOCUMENT_NOT_SELECTED', 'Оберіть хоча б один документ.');
  }

  if (files.length > MAX_VEHICLE_DOCUMENT_BATCH_FILES) {
    return validationError(
      'DOCUMENT_BATCH_LIMIT_REACHED',
      `За один раз можна завантажити до ${MAX_VEHICLE_DOCUMENT_BATCH_FILES} документів.`
    );
  }

  if (existingCount + files.length > MAX_VEHICLE_DOCUMENTS) {
    return validationError(
      'DOCUMENT_COUNT_LIMIT_REACHED',
      `Для ${ownerLabel} можна зберігати до ${MAX_VEHICLE_DOCUMENTS} документів.`
    );
  }

  const batchBytes = files.reduce((total, file) => total + file.size, 0);
  if (batchBytes > MAX_VEHICLE_DOCUMENT_BATCH_BYTES) {
    return validationError(
      'DOCUMENT_BATCH_SIZE_LIMIT_REACHED',
      'Загальний розмір документів в одному завантаженні не може перевищувати 60 МБ.'
    );
  }

  for (const file of files) {
    const safeName = sanitizeVehicleDocumentName(file.name);
    if (file.size === 0) {
      return validationError('DOCUMENT_EMPTY', `Файл «${safeName}» порожній.`);
    }
    if (!file.name.trim() || file.name.length > MAX_VEHICLE_DOCUMENT_FILENAME_LENGTH) {
      return validationError(
        'DOCUMENT_FILENAME_INVALID',
        `Назва файла «${safeName}» некоректна або задовга.`
      );
    }

    const mimeType = normalizedMimeType(file);
    const allowedExtensions = VEHICLE_DOCUMENT_EXTENSIONS_BY_MIME[
      mimeType as keyof typeof VEHICLE_DOCUMENT_EXTENSIONS_BY_MIME
    ];
    if (!allowedExtensions) {
      return validationError(
        'DOCUMENT_TYPE_NOT_ALLOWED',
        `Файл «${safeName}» має непідтримуваний формат.`
      );
    }

    const extension = fileExtension(file.name);
    if (
      !extension ||
      !(allowedExtensions as readonly string[]).includes(extension.extension) ||
      extension.secondaryExtensions.some((value) => BLOCKED_SECONDARY_EXTENSIONS.has(value))
    ) {
      return validationError(
        'DOCUMENT_EXTENSION_MISMATCH',
        `Розширення файла «${safeName}» не відповідає його формату.`
      );
    }

    if (file.size > MAX_VEHICLE_DOCUMENT_BYTES) {
      return validationError('DOCUMENT_TOO_LARGE', `Файл «${safeName}» перевищує 15 МБ.`);
    }

    const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!hasExpectedSignature(mimeType, signature)) {
      return validationError(
        'DOCUMENT_SIGNATURE_INVALID',
        `Вміст файла «${safeName}» не відповідає заявленому формату.`
      );
    }
  }

  return {
    ok: true as const,
    files: files.map((file) => ({
      file,
      fileName: sanitizeVehicleDocumentName(file.name),
      mimeType: normalizedMimeType(file)
    }))
  };
}

export function sanitizeVehicleDocumentName(fileName: string) {
  const leafName = fileName.split(/[\\/]/).pop() ?? '';
  const sanitized = leafName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .slice(0, 180);

  return sanitized || 'document';
}

export function formatVehicleDocumentSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} КБ`;
  return `${(size / 1024 / 1024).toFixed(2)} МБ`;
}

export function vehicleDocumentTypeLabel(mimeType: string) {
  const labels: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP'
  };

  return labels[mimeType] ?? 'Файл';
}
