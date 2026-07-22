import 'server-only';

import { revalidatePath } from 'next/cache';

import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { cleanupCloudinaryAssets, deleteCloudinaryAsset, hasCloudinaryConfig, uploadVehicleImage, type CloudinaryVehicleUpload } from '@/lib/cloudinary/server';
import { prisma } from '@/lib/prisma';
import { getVehicleImageFiles, mapVehicleUploadToCreateInput, type VehicleImageActionState, validateVehicleImageFiles, validateVehicleImageOrder } from '@/lib/vehicles/images';

export type VehiclePhotoContext = {
  id: string;
  clientId: string | null;
  companyId: string | null;
  images: Array<{ id: string; publicId: string; sortOrder: number; isPrimary: boolean }>;
};

type VehiclePhotoActor = { userId: string; role: 'ADMIN' | 'MANAGER' | 'CLIENT' };

export function revalidateVehiclePhotoPaths(vehicle: Pick<VehiclePhotoContext, 'id' | 'clientId' | 'companyId'>) {
  revalidatePath(`/admin/vehicles/${vehicle.id}/edit`);
  revalidatePath('/client');
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  revalidatePath(`/client/vehicles/${vehicle.id}/photos`);
  if (vehicle.companyId) revalidatePath(`/admin/companies/${vehicle.companyId}`);
  if (vehicle.clientId) revalidatePath(`/admin/clients/${vehicle.clientId}`);
}

function auditContext(vehicle: VehiclePhotoContext, actor: VehiclePhotoActor) {
  return { actor: auditUserActor(actor.userId), companyId: vehicle.companyId, entityType: 'VEHICLE' as const, entityId: vehicle.id, action: 'ENTITY_UPDATED' as const, category: 'STANDARD' as const };
}

const VEHICLE_IMAGE_AUDIT_METADATA_FIELDS = [
  'event', 'actorRole', 'imageIds', 'count', 'primaryImageId', 'ownerType',
  'ownerId', 'imageId', 'wasPrimary', 'sortOrder'
] as const;

export async function uploadVehicleImagesForActor(vehicle: VehiclePhotoContext, actor: VehiclePhotoActor, formData: FormData): Promise<VehicleImageActionState> {
  const files = getVehicleImageFiles(formData);
  const validation = validateVehicleImageFiles(files, vehicle.images.length);
  if (!validation.ok) return { status: 'error', message: validation.message };
  if (!hasCloudinaryConfig()) return { status: 'error', message: 'Сховище фотографій тимчасово недоступне.' };

  const uploads: CloudinaryVehicleUpload[] = [];
  try {
    for (const file of files) uploads.push(await uploadVehicleImage(vehicle.id, file));
    const maxSortOrder = vehicle.images.reduce((max, image) => Math.max(max, image.sortOrder), -1);
    const hasPrimary = vehicle.images.some((image) => image.isPrimary);
    await prisma.$transaction(async (tx) => {
      const created = await Promise.all(uploads.map((upload, index) => tx.vehicleImage.create({ data: mapVehicleUploadToCreateInput({ vehicleId: vehicle.id, upload, sortOrder: maxSortOrder + index + 1, isPrimary: !hasPrimary && index === 0 }) })));
      await writeAuditLog(tx, {
        ...auditContext(vehicle, actor),
        metadata: { event: 'VEHICLE_IMAGE_UPLOADED', actorRole: actor.role, imageIds: created.map((image) => image.id), count: created.length, primaryImageId: created.find((image) => image.isPrimary)?.id ?? null, ownerType: vehicle.companyId ? 'company' : 'client', ownerId: vehicle.companyId ?? vehicle.clientId },
        allowedFields: { metadata: VEHICLE_IMAGE_AUDIT_METADATA_FIELDS }
      });
    });
  } catch {
    await cleanupCloudinaryAssets(uploads.map((upload) => upload.publicId));
    return { status: 'error', message: 'Не вдалося завантажити фотографії.' };
  }
  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Фотографії завантажено.' };
}

export async function setPrimaryVehicleImageForActor(vehicle: VehiclePhotoContext, actor: VehiclePhotoActor, imageId: string) {
  if (!vehicle.images.some((image) => image.id === imageId)) return { status: 'error', message: 'Фотографію не знайдено.' } satisfies VehicleImageActionState;
  const oldPrimaryImageId = vehicle.images.find((image) => image.isPrimary)?.id ?? null;
  if (oldPrimaryImageId === imageId) return { status: 'success', message: 'Це фото вже є головним.' } satisfies VehicleImageActionState;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehicleImage.updateMany({ where: { vehicleId: vehicle.id }, data: { isPrimary: false } });
      await tx.vehicleImage.update({ where: { id: imageId, vehicleId: vehicle.id }, data: { isPrimary: true } });
      await writeAuditLog(tx, { ...auditContext(vehicle, actor), oldValue: { primaryImageId: oldPrimaryImageId }, newValue: { primaryImageId: imageId }, metadata: { event: 'VEHICLE_IMAGE_PRIMARY_CHANGED', actorRole: actor.role }, allowedFields: { oldValue: ['primaryImageId'], newValue: ['primaryImageId'], metadata: VEHICLE_IMAGE_AUDIT_METADATA_FIELDS } });
    });
  } catch {
    return { status: 'error', message: 'Не вдалося змінити головне фото.' } satisfies VehicleImageActionState;
  }
  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Головне фото оновлено.' } satisfies VehicleImageActionState;
}

export async function reorderVehicleImagesForActor(vehicle: VehiclePhotoContext, actor: VehiclePhotoActor, orderedImageIds: string[]) {
  if (!validateVehicleImageOrder(vehicle.images.map((image) => image.id), orderedImageIds)) return { status: 'error', message: 'Не вдалося перевірити порядок фотографій.' } satisfies VehicleImageActionState;
  const oldOrder = vehicle.images.map((image) => image.id);
  if (oldOrder.every((id, index) => id === orderedImageIds[index])) return { status: 'success', message: 'Порядок фотографій не змінився.' } satisfies VehicleImageActionState;
  try {
    await prisma.$transaction(async (tx) => {
      await Promise.all(orderedImageIds.map((id, sortOrder) => tx.vehicleImage.update({ where: { id, vehicleId: vehicle.id }, data: { sortOrder } })));
      await writeAuditLog(tx, { ...auditContext(vehicle, actor), oldValue: { imageOrder: oldOrder }, newValue: { imageOrder: orderedImageIds }, metadata: { event: 'VEHICLE_IMAGES_REORDERED', actorRole: actor.role }, allowedFields: { oldValue: ['imageOrder'], newValue: ['imageOrder'], metadata: VEHICLE_IMAGE_AUDIT_METADATA_FIELDS } });
    });
  } catch {
    return { status: 'error', message: 'Не вдалося змінити порядок фотографій.' } satisfies VehicleImageActionState;
  }
  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Порядок фотографій оновлено.' } satisfies VehicleImageActionState;
}

export async function deleteVehicleImageForActor(vehicle: VehiclePhotoContext, actor: VehiclePhotoActor, imageId: string) {
  const image = vehicle.images.find((candidate) => candidate.id === imageId);
  if (!image) return { status: 'error', message: 'Фотографію не знайдено.' } satisfies VehicleImageActionState;
  if (!hasCloudinaryConfig()) return { status: 'error', message: 'Сховище фотографій тимчасово недоступне.' } satisfies VehicleImageActionState;
  try {
    await deleteCloudinaryAsset(image.publicId);
  } catch {
    return { status: 'error', message: 'Не вдалося видалити фотографію.' } satisfies VehicleImageActionState;
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehicleImage.deleteMany({ where: { id: image.id, vehicleId: vehicle.id } });
      const remaining = vehicle.images.filter((candidate) => candidate.id !== image.id);
      await Promise.all(remaining.map((candidate, sortOrder) => tx.vehicleImage.update({ where: { id: candidate.id, vehicleId: vehicle.id }, data: { sortOrder, isPrimary: image.isPrimary ? sortOrder === 0 : candidate.isPrimary } })));
      await writeAuditLog(tx, { ...auditContext(vehicle, actor), metadata: { event: 'VEHICLE_IMAGE_DELETED', actorRole: actor.role, imageId: image.id, wasPrimary: image.isPrimary, sortOrder: image.sortOrder }, allowedFields: { metadata: VEHICLE_IMAGE_AUDIT_METADATA_FIELDS } });
    });
  } catch {
    return { status: 'error', message: 'Фотографію видалено зі сховища, але не вдалося оновити галерею.' } satisfies VehicleImageActionState;
  }
  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Фотографію видалено.' } satisfies VehicleImageActionState;
}
