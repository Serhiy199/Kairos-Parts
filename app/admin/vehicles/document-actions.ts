'use server';

import { revalidatePath } from 'next/cache';

import { requireCrmSession } from '@/lib/admin/access';
import { hasCloudinaryConfig } from '@/lib/cloudinary/server';
import {
  cleanupVehicleDocumentAssets,
  deleteVehicleDocumentAsset,
  uploadVehicleDocument,
  type CloudinaryVehicleDocumentUpload
} from '@/lib/files/cloudinary-vehicle-documents';
import { prisma } from '@/lib/prisma';
import {
  getVehicleDocumentFiles,
  sanitizeVehicleDocumentName,
  type VehicleDocumentActionState,
  validateVehicleDocumentFiles
} from '@/lib/vehicles/documents';

const GENERIC_UPLOAD_ERROR = 'Не вдалося завантажити документи.';

async function getVehicleDocumentContext(vehicleId: string) {
  return prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      clientId: true,
      companyId: true,
      _count: { select: { documents: true } }
    }
  });
}

function revalidateVehicleDocumentPaths(vehicle: { id: string; clientId: string | null; companyId: string | null }) {
  revalidatePath(`/admin/vehicles/${vehicle.id}/edit`);
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  revalidatePath('/client/documents');

  if (vehicle.companyId) {
    revalidatePath(`/admin/companies/${vehicle.companyId}`);
  } else if (vehicle.clientId) {
    revalidatePath(`/admin/clients/${vehicle.clientId}`);
  }
}

export async function uploadAdminVehicleDocuments(
  vehicleId: string,
  _state: VehicleDocumentActionState,
  formData: FormData
): Promise<VehicleDocumentActionState> {
  const session = await requireCrmSession();
  const vehicle = await getVehicleDocumentContext(vehicleId);

  if (!vehicle) return { status: 'error', message: 'Техніку не знайдено.' };

  const files = getVehicleDocumentFiles(formData);
  const validation = await validateVehicleDocumentFiles(files, vehicle._count.documents);
  if (!validation.ok) return { status: 'error', message: validation.message };

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' };
  }

  const visibleToClient = formData.get('visibleToClient') === 'on';
  const uploads: Array<{ file: File; upload: CloudinaryVehicleDocumentUpload }> = [];

  try {
    for (const file of files) {
      uploads.push({ file, upload: await uploadVehicleDocument(vehicle.id, file) });
    }

    await prisma.document.createMany({
      data: uploads.map(({ file, upload }) => ({
        vehicleId: vehicle.id,
        fileName: sanitizeVehicleDocumentName(file.name),
        storageKey: upload.storageKey,
        fileUrl: null,
        mimeType: file.type,
        size: upload.bytes,
        visibleToClient,
        uploadedById: session.user.id
      }))
    });
  } catch {
    await cleanupVehicleDocumentAssets(uploads.map(({ upload }) => upload.storageKey));
    return { status: 'error', message: GENERIC_UPLOAD_ERROR };
  }

  revalidateVehicleDocumentPaths(vehicle);
  return { status: 'success', message: 'Документи завантажено.' };
}

export async function setVehicleDocumentVisibility(vehicleId: string, documentId: string, visibleToClient: boolean) {
  await requireCrmSession();
  const vehicle = await getVehicleDocumentContext(vehicleId);
  const document = vehicle
    ? await prisma.document.findFirst({ where: { id: documentId, vehicleId: vehicle.id }, select: { id: true } })
    : null;

  if (!vehicle || !document) {
    return { status: 'error', message: 'Документ не знайдено.' } satisfies VehicleDocumentActionState;
  }

  try {
    await prisma.document.update({ where: { id: document.id }, data: { visibleToClient } });
  } catch {
    return { status: 'error', message: 'Не вдалося змінити видимість документа.' } satisfies VehicleDocumentActionState;
  }

  revalidateVehicleDocumentPaths(vehicle);
  return {
    status: 'success',
    message: visibleToClient ? 'Документ відкрито клієнту.' : 'Документ приховано від клієнта.'
  } satisfies VehicleDocumentActionState;
}

export async function deleteAdminVehicleDocument(vehicleId: string, documentId: string) {
  await requireCrmSession();
  const vehicle = await getVehicleDocumentContext(vehicleId);
  const document = vehicle
    ? await prisma.document.findFirst({
        where: { id: documentId, vehicleId: vehicle.id },
        select: { id: true, storageKey: true }
      })
    : null;

  if (!vehicle || !document) {
    return { status: 'error', message: 'Документ не знайдено.' } satisfies VehicleDocumentActionState;
  }

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' } satisfies VehicleDocumentActionState;
  }

  try {
    await deleteVehicleDocumentAsset(document.storageKey);
  } catch {
    return { status: 'error', message: 'Не вдалося видалити документ зі сховища.' } satisfies VehicleDocumentActionState;
  }

  try {
    await prisma.document.deleteMany({ where: { id: document.id, vehicleId: vehicle.id } });
  } catch {
    return { status: 'error', message: 'Файл видалено зі сховища, але запис документа не вдалося видалити.' } satisfies VehicleDocumentActionState;
  }

  revalidateVehicleDocumentPaths(vehicle);
  return { status: 'success', message: 'Документ видалено.' } satisfies VehicleDocumentActionState;
}
