'use server';

import { revalidatePath } from 'next/cache';

import { requireCrmSession } from '@/lib/admin/access';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
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
const OWNER_DOCUMENT_AUDIT_METADATA_FIELDS = [
  'event', 'actorRole', 'documentOwnerType', 'documents', 'documentId',
  'originalName', 'visibleToClient', 'mimeType', 'size'
] as const;

function ownerAuditTarget(owner: DocumentOwnerContext) {
  if (owner.type === 'company') return { entityType: 'COMPANY' as const, entityId: owner.companyId, companyId: owner.companyId };
  if (owner.type === 'client') return { entityType: 'USER' as const, entityId: owner.clientId, companyId: null };
  return { entityType: 'VEHICLE' as const, entityId: owner.vehicleId, companyId: null };
}

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

    await prisma.$transaction(async (tx) => {
      const created = await Promise.all(uploads.map(({ file, upload }) => tx.document.create({ data: {
        ...ownerData,
        fileName: sanitizeVehicleDocumentName(file.name),
        storageKey: upload.storageKey,
        fileUrl: null,
        mimeType: file.type,
        size: upload.bytes,
        visibleToClient,
        uploadedById: session.user.id
      } })));
      const auditTarget = ownerAuditTarget(owner);
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        ...auditTarget,
        action: 'ENTITY_UPDATED',
        category: 'STANDARD',
        metadata: {
          event: owner.type === 'company' ? 'COMPANY_DOCUMENT_UPLOADED' : 'CLIENT_DOCUMENT_UPLOADED',
          actorRole: session.user.role, documentOwnerType: owner.type,
          documents: created.map((document) => ({ id: document.id, originalName: document.fileName, mimeType: document.mimeType, size: document.size, visibleToClient: document.visibleToClient }))
        },
        allowedFields: { metadata: OWNER_DOCUMENT_AUDIT_METADATA_FIELDS }
      });
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
  const session = await requireCrmSession();
  const owner = await resolveOwner(ownerType, ownerId);
  const document = owner
    ? await prisma.document.findFirst({ where: { id: documentId, ...ownerDocumentWhere(owner) }, select: { id: true, visibleToClient: true } })
    : null;

  if (!owner || !document) return { status: 'error', message: 'Документ не знайдено.' };
  if (document.visibleToClient === visibleToClient) return { status: 'success', message: 'Доступ до документа не змінився.' };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: document.id }, data: { visibleToClient } });
      const auditTarget = ownerAuditTarget(owner);
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id), ...auditTarget,
        action: 'ENTITY_UPDATED', category: 'STANDARD', oldValue: { visibleToClient: document.visibleToClient }, newValue: { visibleToClient },
        metadata: { event: owner.type === 'company' ? 'COMPANY_DOCUMENT_VISIBILITY_CHANGED' : 'CLIENT_DOCUMENT_VISIBILITY_CHANGED', actorRole: session.user.role, documentOwnerType: owner.type, documentId: document.id },
        allowedFields: { oldValue: ['visibleToClient'], newValue: ['visibleToClient'], metadata: OWNER_DOCUMENT_AUDIT_METADATA_FIELDS }
      });
    });
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
  const session = await requireCrmSession();
  const owner = await resolveOwner(ownerType, ownerId);
  const document = owner
    ? await prisma.document.findFirst({
        where: { id: documentId, ...ownerDocumentWhere(owner) },
        select: { id: true, storageKey: true, fileName: true, visibleToClient: true, mimeType: true, size: true }
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
    await prisma.$transaction(async (tx) => {
      await tx.document.deleteMany({ where: { id: document.id, ...ownerDocumentWhere(owner) } });
      const auditTarget = ownerAuditTarget(owner);
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id), ...auditTarget,
        action: 'ENTITY_UPDATED',
        category: 'STANDARD',
        metadata: {
          event: owner.type === 'company' ? 'COMPANY_DOCUMENT_DELETED' : 'CLIENT_DOCUMENT_DELETED', actorRole: session.user.role,
          documentOwnerType: owner.type, documentId: document.id, originalName: document.fileName,
          visibleToClient: document.visibleToClient, mimeType: document.mimeType, size: document.size
        },
        allowedFields: { metadata: OWNER_DOCUMENT_AUDIT_METADATA_FIELDS }
      });
    });
  } catch {
    return { status: 'error', message: 'Файл видалено зі сховища, але запис документа не вдалося видалити.' };
  }

  revalidateOwnerDocumentPaths(owner);
  return { status: 'success', message: 'Документ видалено.' };
}
