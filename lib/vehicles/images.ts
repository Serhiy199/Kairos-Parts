import type { CloudinaryVehicleUpload } from '@/lib/cloudinary/server';

export const MAX_VEHICLE_IMAGES = 10;
export const MAX_VEHICLE_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_VEHICLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type VehicleImageActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const EMPTY_VEHICLE_IMAGE_ACTION_STATE: VehicleImageActionState = { status: 'idle' };

export function getVehicleImageFiles(formData: FormData) {
  return formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function validateVehicleImageFiles(files: File[], existingCount: number) {
  if (files.length === 0) {
    return { ok: false as const, message: 'Оберіть хоча б одну фотографію.' };
  }

  if (existingCount + files.length > MAX_VEHICLE_IMAGES) {
    return { ok: false as const, message: `Можна додати не більше ${MAX_VEHICLE_IMAGES} фотографій.` };
  }

  if (files.some((file) => !ALLOWED_VEHICLE_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_VEHICLE_IMAGE_TYPES)[number]))) {
    return { ok: false as const, message: 'Файл має непідтримуваний формат. Дозволені JPEG, PNG або WebP.' };
  }

  if (files.some((file) => file.size > MAX_VEHICLE_IMAGE_BYTES)) {
    return { ok: false as const, message: 'Файл перевищує максимальний розмір 8 МБ.' };
  }

  return { ok: true as const };
}

export function mapVehicleUploadToCreateInput(params: {
  vehicleId: string;
  upload: CloudinaryVehicleUpload;
  sortOrder: number;
  isPrimary: boolean;
}) {
  return {
    vehicleId: params.vehicleId,
    publicId: params.upload.publicId,
    secureUrl: params.upload.secureUrl,
    width: params.upload.width ?? null,
    height: params.upload.height ?? null,
    bytes: params.upload.bytes ?? null,
    format: params.upload.format ?? null,
    sortOrder: params.sortOrder,
    isPrimary: params.isPrimary
  };
}

export function validateVehicleImageOrder(currentIds: string[], orderedIds: string[]) {
  if (currentIds.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    return false;
  }

  const current = new Set(currentIds);
  return orderedIds.every((id) => current.has(id));
}
