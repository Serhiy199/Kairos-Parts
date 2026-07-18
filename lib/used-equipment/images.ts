import type { UsedEquipmentStatus } from '@prisma/client';

import type { CloudinaryUsedEquipmentUpload } from '@/lib/cloudinary/server';
import { USED_EQUIPMENT_NO_IMAGE_STATUSES } from '@/lib/used-equipment/validation';

export const MAX_USED_EQUIPMENT_IMAGES = 15;
export const MAX_USED_EQUIPMENT_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_USED_EQUIPMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type UsedEquipmentImageKey = `existing:${string}` | `new:${number}`;

export type ExistingUsedEquipmentImageInput = {
  id: string;
  cloudinaryPublicId: string;
  sortOrder: number;
  isPrimary: boolean;
};

export function getUsedEquipmentImageFiles(formData: FormData) {
  return formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function validateUsedEquipmentImageFiles(files: File[], options: { existingCount: number; requireAtLeastOne: boolean }) {
  const totalCount = options.existingCount + files.length;

  if (options.requireAtLeastOne && totalCount < 1) {
    return { ok: false as const, message: 'Додайте хоча б одне фото техніки.' };
  }

  if (totalCount > MAX_USED_EQUIPMENT_IMAGES) {
    return { ok: false as const, message: `Можна додати максимум ${MAX_USED_EQUIPMENT_IMAGES} фото для однієї одиниці техніки.` };
  }

  const invalidType = files.find((file) => !ALLOWED_USED_EQUIPMENT_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_USED_EQUIPMENT_IMAGE_TYPES)[number]));
  if (invalidType) {
    return { ok: false as const, message: 'Дозволені лише JPG, PNG або WEBP фото.' };
  }

  const oversized = files.find((file) => file.size > MAX_USED_EQUIPMENT_IMAGE_BYTES);
  if (oversized) {
    return { ok: false as const, message: 'Розмір одного фото не має перевищувати 10 MB.' };
  }

  return { ok: true as const };
}

export function canUseUsedEquipmentStatusWithImageCount(status: UsedEquipmentStatus, imageCount: number) {
  return imageCount > 0 || (USED_EQUIPMENT_NO_IMAGE_STATUSES as readonly UsedEquipmentStatus[]).includes(status);
}

function parseImageKey(value: string): UsedEquipmentImageKey | null {
  if (value.startsWith('existing:') && value.length > 'existing:'.length) {
    return value as UsedEquipmentImageKey;
  }

  if (/^new:\d+$/.test(value)) {
    return value as UsedEquipmentImageKey;
  }

  return null;
}

export function parseUsedEquipmentImageKeys(formData: FormData, existingImages: ExistingUsedEquipmentImageInput[], newFiles: File[]) {
  const existingIds = new Set(existingImages.map((image) => image.id));
  const deletedIds = new Set(
    String(formData.get('deletedImageIds') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => existingIds.has(id))
  );
  const availableExistingIds = new Set(existingImages.filter((image) => !deletedIds.has(image.id)).map((image) => image.id));
  const usedKeys = new Set<string>();

  const requestedOrder = String(formData.get('imageOrder') ?? '')
    .split(',')
    .map((value) => parseImageKey(value.trim()))
    .filter((key): key is UsedEquipmentImageKey => {
      if (!key || usedKeys.has(key)) {
        return false;
      }

      if (key.startsWith('existing:')) {
        const id = key.slice('existing:'.length);
        if (!availableExistingIds.has(id)) {
          return false;
        }
      } else {
        const index = Number.parseInt(key.slice('new:'.length), 10);
        if (index < 0 || index >= newFiles.length) {
          return false;
        }
      }

      usedKeys.add(key);
      return true;
    });

  const fallbackExistingKeys = existingImages
    .filter((image) => !deletedIds.has(image.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => `existing:${image.id}` as UsedEquipmentImageKey);
  const fallbackNewKeys = newFiles.map((_, index) => `new:${index}` as UsedEquipmentImageKey);
  const orderedKeys = [...requestedOrder];

  for (const key of [...fallbackExistingKeys, ...fallbackNewKeys]) {
    if (!usedKeys.has(key)) {
      orderedKeys.push(key);
      usedKeys.add(key);
    }
  }

  const requestedPrimary = parseImageKey(String(formData.get('primaryImageKey') ?? '').trim());
  const primaryImageKey = requestedPrimary && usedKeys.has(requestedPrimary) ? requestedPrimary : orderedKeys[0] ?? null;

  return {
    deletedIds,
    orderedKeys,
    primaryImageKey
  };
}

export function getCreatePrimaryIndex(formData: FormData, fileCount: number) {
  const value = Number.parseInt(String(formData.get('primarySelectedIndex') ?? '0'), 10);
  if (!Number.isFinite(value) || value < 0 || value >= fileCount) {
    return 0;
  }

  return value;
}

export function mapUploadToImageCreateInput(params: {
  upload: CloudinaryUsedEquipmentUpload;
  usedEquipmentId: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}) {
  return {
    usedEquipmentId: params.usedEquipmentId,
    url: params.upload.secureUrl,
    cloudinaryPublicId: params.upload.publicId,
    sortOrder: params.sortOrder,
    isPrimary: params.isPrimary,
    alt: params.alt,
    width: params.upload.width ?? null,
    height: params.upload.height ?? null,
    format: params.upload.format ?? null,
    bytes: params.upload.bytes ?? null
  };
}
