export const MAX_VEHICLE_DOCUMENTS = 25;
export const MAX_VEHICLE_DOCUMENT_BYTES = 15 * 1024 * 1024;

const ALLOWED_VEHICLE_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export type VehicleDocumentActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const EMPTY_VEHICLE_DOCUMENT_ACTION_STATE: VehicleDocumentActionState = { status: 'idle' };

export function getVehicleDocumentFiles(formData: FormData) {
  return formData.getAll('documents').filter((value): value is File => value instanceof File && value.size > 0);
}

function hasExpectedSignature(file: File, bytes: Uint8Array) {
  if (file.type === 'application/pdf') {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  }

  if (file.type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  if (file.type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }

  return false;
}

export async function validateVehicleDocumentFiles(files: File[], existingCount: number) {
  if (files.length === 0) {
    return { ok: false as const, message: 'Оберіть хоча б один документ.' };
  }

  if (existingCount + files.length > MAX_VEHICLE_DOCUMENTS) {
    return { ok: false as const, message: `Для однієї одиниці техніки можна зберігати до ${MAX_VEHICLE_DOCUMENTS} документів.` };
  }

  for (const file of files) {
    if (!ALLOWED_VEHICLE_DOCUMENT_TYPES.has(file.type)) {
      return { ok: false as const, message: `Файл «${sanitizeVehicleDocumentName(file.name)}» має непідтримуваний формат.` };
    }

    if (file.size > MAX_VEHICLE_DOCUMENT_BYTES) {
      return { ok: false as const, message: `Файл «${sanitizeVehicleDocumentName(file.name)}» перевищує 15 МБ.` };
    }

    const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!hasExpectedSignature(file, signature)) {
      return { ok: false as const, message: `Вміст файла «${sanitizeVehicleDocumentName(file.name)}» не відповідає заявленому формату.` };
    }
  }

  return { ok: true as const };
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
