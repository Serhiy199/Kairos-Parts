'use server';

import { revalidatePath } from 'next/cache';

import { requireCrmSession } from '@/lib/admin/access';
import {
  cleanupCloudinaryAssets,
  deleteCloudinaryAsset,
  hasCloudinaryConfig,
  uploadVehicleImage,
  type CloudinaryVehicleUpload
} from '@/lib/cloudinary/server';
import { prisma } from '@/lib/prisma';
import {
  getVehicleImageFiles,
  mapVehicleUploadToCreateInput,
  type VehicleImageActionState,
  validateVehicleImageFiles,
  validateVehicleImageOrder
} from '@/lib/vehicles/images';

const GENERIC_UPLOAD_ERROR = 'Не вдалося завантажити фотографії.';

async function getVehicleContext(vehicleId: string) {
  return prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      clientId: true,
      companyId: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, publicId: true, sortOrder: true, isPrimary: true }
      }
    }
  });
}

function revalidateVehiclePhotoPaths(vehicle: { id: string; clientId: string | null; companyId: string | null }) {
  revalidatePath(`/admin/vehicles/${vehicle.id}/edit`);
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);

  if (vehicle.companyId) {
    revalidatePath(`/admin/companies/${vehicle.companyId}`);
  } else if (vehicle.clientId) {
    revalidatePath(`/admin/clients/${vehicle.clientId}`);
  }
}

export async function uploadAdminVehicleImages(
  vehicleId: string,
  _state: VehicleImageActionState,
  formData: FormData
): Promise<VehicleImageActionState> {
  await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);

  if (!vehicle) {
    return { status: 'error', message: 'Техніку не знайдено.' };
  }

  const files = getVehicleImageFiles(formData);
  const validation = validateVehicleImageFiles(files, vehicle.images.length);
  if (!validation.ok) {
    return { status: 'error', message: validation.message };
  }

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище фотографій тимчасово недоступне.' };
  }

  const uploads: CloudinaryVehicleUpload[] = [];
  try {
    for (const file of files) {
      uploads.push(await uploadVehicleImage(vehicle.id, file));
    }

    const maxSortOrder = vehicle.images.reduce((max, image) => Math.max(max, image.sortOrder), -1);
    const hasPrimary = vehicle.images.some((image) => image.isPrimary);

    await prisma.vehicleImage.createMany({
      data: uploads.map((upload, index) =>
        mapVehicleUploadToCreateInput({
          vehicleId: vehicle.id,
          upload,
          sortOrder: maxSortOrder + index + 1,
          isPrimary: !hasPrimary && index === 0
        })
      )
    });
  } catch {
    await cleanupCloudinaryAssets(uploads.map((upload) => upload.publicId));
    return { status: 'error', message: GENERIC_UPLOAD_ERROR };
  }

  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Фотографії завантажено.' };
}

export async function setPrimaryVehicleImage(vehicleId: string, imageId: string) {
  await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  if (!vehicle || !vehicle.images.some((image) => image.id === imageId)) {
    return { status: 'error', message: 'Фотографію не знайдено.' } satisfies VehicleImageActionState;
  }

  try {
    await prisma.$transaction([
      prisma.vehicleImage.updateMany({ where: { vehicleId: vehicle.id }, data: { isPrimary: false } }),
      prisma.vehicleImage.update({ where: { id: imageId }, data: { isPrimary: true } })
    ]);
  } catch {
    return { status: 'error', message: 'Не вдалося змінити головне фото.' } satisfies VehicleImageActionState;
  }

  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Головне фото оновлено.' } satisfies VehicleImageActionState;
}

export async function reorderAdminVehicleImages(vehicleId: string, orderedImageIds: string[]) {
  await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  if (!vehicle || !validateVehicleImageOrder(vehicle.images.map((image) => image.id), orderedImageIds)) {
    return { status: 'error', message: 'Не вдалося перевірити порядок фотографій.' } satisfies VehicleImageActionState;
  }

  try {
    await prisma.$transaction(
      orderedImageIds.map((id, sortOrder) =>
        prisma.vehicleImage.update({ where: { id }, data: { sortOrder } })
      )
    );
  } catch {
    return { status: 'error', message: 'Не вдалося змінити порядок фотографій.' } satisfies VehicleImageActionState;
  }

  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Порядок фотографій оновлено.' } satisfies VehicleImageActionState;
}

export async function deleteAdminVehicleImage(vehicleId: string, imageId: string) {
  await requireCrmSession();
  const vehicle = await getVehicleContext(vehicleId);
  const image = vehicle?.images.find((candidate) => candidate.id === imageId);
  if (!vehicle || !image) {
    return { status: 'error', message: 'Фотографію не знайдено.' } satisfies VehicleImageActionState;
  }

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище фотографій тимчасово недоступне.' } satisfies VehicleImageActionState;
  }

  try {
    await deleteCloudinaryAsset(image.publicId);
  } catch {
    return { status: 'error', message: 'Не вдалося видалити фотографію.' } satisfies VehicleImageActionState;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehicleImage.deleteMany({ where: { id: image.id, vehicleId: vehicle.id } });
      const remaining = vehicle.images.filter((candidate) => candidate.id !== image.id);

      await Promise.all(
        remaining.map((candidate, sortOrder) =>
          tx.vehicleImage.update({
            where: { id: candidate.id },
            data: {
              sortOrder,
              isPrimary: image.isPrimary ? sortOrder === 0 : candidate.isPrimary
            }
          })
        )
      );
    });
  } catch {
    return { status: 'error', message: 'Фотографію видалено зі сховища, але не вдалося оновити галерею.' } satisfies VehicleImageActionState;
  }

  revalidateVehiclePhotoPaths(vehicle);
  return { status: 'success', message: 'Фотографію видалено.' } satisfies VehicleImageActionState;
}
