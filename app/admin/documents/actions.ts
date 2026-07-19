'use server';

import { revalidatePath } from 'next/cache';

import { requireCrmSession } from '@/lib/admin/access';
import { hasCloudinaryConfig } from '@/lib/cloudinary/server';
import { documentOwnerData, hasExactlyOneDocumentOwner, ownerDocumentWhere, type DocumentOwnerContext, type OwnerDocumentType } from '@/lib/documents/ownership';
import {
  cleanupDocumentAssets,
  deleteDocumentAsset,
  uploadDocument,
  type CloudinaryDocumentUpload
} from '@/lib/files/cloudinary-vehicle-documents';
import { prisma } from '@/lib/prisma';
import {
  getVehicleDocumentFiles,
  sanitizeVehicleDocumentName,
  type VehicleDocumentActionState,
  validateVehicleDocumentFiles
} from '@/lib/vehicles/documents';

const GENERIC_UPLOAD_ERROR = 'Не вдалося завантажити документ.';

async function resolveOwner(type: OwnerDocumentType, ownerId: string): Promise<DocumentOwnerContext | null> {
  if (type === 'company') {
    const company = await prisma.company.findUnique({ where: { id: ownerId }, select: { id: true } });
    return company ? { type, companyId: company.id } : null;
  }

  if (type === 'client') {
    const client = await prisma.clientProfile.findFirst({
      where: { id: ownerId, user: { role: 'CLIENT' } },
      select: { id: true }
    });
    return client ? { type, clientId: client.id } : null;
  }

  return null;
}

function revalidateOwnerDocumentPaths(owner: DocumentOwnerContext) {
  revalidatePath('/client/documents');

  if (owner.type === 'company') {
    revalidatePath(`/admin/companies/${owner.companyId}`);
  } else if (owner.type === 'client') {
    revalidatePath(`/admin/clients/${owner.clientId}`);
  }
}

export async function uploadAdminOwnerDocuments(
  ownerType: OwnerDocumentType,
  ownerId: string,
  _state: VehicleDocumentActionState,
  formData: FormData
): Promise<VehicleDocumentActionState> {
  const session = await requireCrmSession();
  const owner = await resolveOwner(ownerType, ownerId);
  if (!owner) return { status: 'error', message: 'Власника документів не знайдено.' };

  const existingCount = await prisma.document.count({ where: ownerDocumentWhere(owner) });
  const files = getVehicleDocumentFiles(formData);
  const validation = await validateVehicleDocumentFiles(files, existingCount, 'цього власника');
  if (!validation.ok) return { status: 'error', message: validation.message };

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' };
  }

  const visibleToClient = formData.get('visibleToClient') === 'on';
  const uploads: Array<{ file: File; upload: CloudinaryDocumentUpload }> = [];
  const ownerData = documentOwnerData(owner);

  if (!hasExactlyOneDocumentOwner(ownerData)) {
    return { status: 'error', message: GENERIC_UPLOAD_ERROR };
  }

  try {
    for (const file of files) {
      uploads.push({ file, upload: await uploadDocument(owner, file) });
    }

    await prisma.document.createMany({
      data: uploads.map(({ file, upload }) => ({
        ...ownerData,
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
    await cleanupDocumentAssets(uploads.map(({ upload }) => upload.storageKey));
    return { status: 'error', message: GENERIC_UPLOAD_ERROR };
  }

  revalidateOwnerDocumentPaths(owner);
  return { status: 'success', message: 'Документи завантажено.' };
}

export async function setOwnerDocumentVisibility(
  ownerType: OwnerDocumentType,
  ownerId: string,
  documentId: string,
  visibleToClient: boolean
): Promise<VehicleDocumentActionState> {
  await requireCrmSession();
  const owner = await resolveOwner(ownerType, ownerId);
  const document = owner
    ? await prisma.document.findFirst({ where: { id: documentId, ...ownerDocumentWhere(owner) }, select: { id: true } })
    : null;

  if (!owner || !document) return { status: 'error', message: 'Документ не знайдено.' };

  try {
    await prisma.document.update({ where: { id: document.id }, data: { visibleToClient } });
  } catch {
    return { status: 'error', message: 'Не вдалося змінити доступ до документа.' };
  }

  revalidateOwnerDocumentPaths(owner);
  return {
    status: 'success',
    message: visibleToClient ? 'Документ відкрито клієнту.' : 'Документ приховано від клієнта.'
  };
}

export async function deleteAdminOwnerDocument(
  ownerType: OwnerDocumentType,
  ownerId: string,
  documentId: string
): Promise<VehicleDocumentActionState> {
  await requireCrmSession();
  const owner = await resolveOwner(ownerType, ownerId);
  const document = owner
    ? await prisma.document.findFirst({
        where: { id: documentId, ...ownerDocumentWhere(owner) },
        select: { id: true, storageKey: true }
      })
    : null;

  if (!owner || !document) return { status: 'error', message: 'Документ не знайдено.' };
  if (!hasCloudinaryConfig()) return { status: 'error', message: 'Сховище документів тимчасово недоступне.' };

  try {
    await deleteDocumentAsset(document.storageKey);
  } catch {
    return { status: 'error', message: 'Не вдалося видалити документ.' };
  }

  try {
    await prisma.document.deleteMany({ where: { id: document.id, ...ownerDocumentWhere(owner) } });
  } catch {
    return { status: 'error', message: 'Файл видалено зі сховища, але запис документа не вдалося видалити.' };
  }

  revalidateOwnerDocumentPaths(owner);
  return { status: 'success', message: 'Документ видалено.' };
}
