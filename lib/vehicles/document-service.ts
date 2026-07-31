import 'server-only';

import { Prisma } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { resolveDocumentSourceForActor } from '@/lib/documents/source';
import {
  cleanupVehicleDocumentAssets,
  deleteVehicleDocumentAsset,
  uploadVehicleDocument,
  type CloudinaryVehicleDocumentUpload
} from '@/lib/files/cloudinary-vehicle-documents';
import { prisma } from '@/lib/prisma';
import {
  canDeleteVehicleDocument,
  clientDeletableVehicleDocumentWhere,
  type VehicleDocumentActor
} from '@/lib/vehicles/document-access';
import {
  MAX_VEHICLE_DOCUMENTS,
  MAX_VEHICLE_DOCUMENT_TOTAL_BYTES,
  type VehicleDocumentValidationCode,
  type VehicleDocumentActionState,
  validateVehicleDocumentFiles
} from '@/lib/vehicles/documents';
import { vehicleAccessWhere } from '@/lib/client/access';

const AUDIT_METADATA_FIELDS = [
  'event',
  'actorRole',
  'source',
  'documents',
  'documentId',
  'originalName',
  'visibleToClient',
  'mimeType',
  'size'
] as const;

export type VehicleDocumentServiceCode =
  | VehicleDocumentValidationCode
  | 'VEHICLE_NOT_FOUND'
  | 'VEHICLE_ACCESS_DENIED'
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_ACCESS_DENIED'
  | 'DOCUMENT_COUNT_LIMIT_REACHED'
  | 'DOCUMENT_TOTAL_SIZE_LIMIT_REACHED'
  | 'DOCUMENT_UPLOAD_FAILED'
  | 'DOCUMENT_DB_SAVE_FAILED'
  | 'DOCUMENT_ASSET_CLEANUP_FAILED'
  | 'DOCUMENT_DELETE_FAILED';

export type VehicleDocumentServiceResult =
  | {
      ok: true;
      documentIds: string[];
    }
  | {
      ok: false;
      code: VehicleDocumentServiceCode;
      message: string;
      cleanupFailed?: boolean;
    };

class VehicleDocumentQuotaError extends Error {
  constructor(
    readonly code:
      | 'DOCUMENT_COUNT_LIMIT_REACHED'
      | 'DOCUMENT_TOTAL_SIZE_LIMIT_REACHED'
  ) {
    super(code);
    this.name = 'VehicleDocumentQuotaError';
  }
}

function vehicleWhereForActor(vehicleId: string, actor: VehicleDocumentActor) {
  if (actor.role === 'CLIENT') {
    return { id: vehicleId, AND: [vehicleAccessWhere(actor.access)] };
  }
  return { id: vehicleId };
}

async function getVehicleContext(vehicleId: string, actor: VehicleDocumentActor) {
  return prisma.vehicle.findFirst({
    where: vehicleWhereForActor(vehicleId, actor),
    select: {
      id: true,
      clientId: true,
      companyId: true,
      _count: { select: { documents: true } },
      documents: { select: { size: true } }
    }
  });
}

function documentErrorMessage(code: VehicleDocumentServiceCode) {
  if (code === 'DOCUMENT_COUNT_LIMIT_REACHED') {
    return `Для однієї одиниці техніки можна зберігати до ${MAX_VEHICLE_DOCUMENTS} документів.`;
  }
  if (code === 'DOCUMENT_TOTAL_SIZE_LIMIT_REACHED') {
    return 'Загальний розмір документів для однієї одиниці техніки не може перевищувати 250 МБ.';
  }
  if (code === 'VEHICLE_NOT_FOUND' || code === 'VEHICLE_ACCESS_DENIED') {
    return 'Техніку не знайдено або вона недоступна.';
  }
  if (code === 'DOCUMENT_NOT_FOUND' || code === 'DOCUMENT_ACCESS_DENIED') {
    return 'Документ не знайдено або він недоступний.';
  }
  return 'Не вдалося виконати операцію з документом.';
}

async function cleanupAfterFailedUpload(
  uploads: Array<{ upload: CloudinaryVehicleDocumentUpload }>,
  causeCode: VehicleDocumentServiceCode
): Promise<VehicleDocumentServiceResult> {
  const cleanup = await cleanupVehicleDocumentAssets(
    uploads.map(({ upload }) => upload.storageKey)
  );
  if (cleanup.failed > 0) {
    console.error('vehicle_document_upload_compensation_failed', {
      causeCode,
      attempted: cleanup.attempted,
      failed: cleanup.failed
    });
    return {
      ok: false,
      code: 'DOCUMENT_ASSET_CLEANUP_FAILED',
      message: documentErrorMessage('DOCUMENT_ASSET_CLEANUP_FAILED'),
      cleanupFailed: true
    };
  }

  return {
    ok: false,
    code: causeCode,
    message: documentErrorMessage(causeCode),
    cleanupFailed: false
  };
}

export async function createVehicleDocument(input: {
  vehicleId: string;
  actor: VehicleDocumentActor;
  files: File[];
  visibleToClient?: boolean;
  requestContext?: AuditRequestContext;
}): Promise<VehicleDocumentServiceResult> {
  const vehicle = await getVehicleContext(input.vehicleId, input.actor);
  if (!vehicle) {
    const code = input.actor.role === 'CLIENT' ? 'VEHICLE_ACCESS_DENIED' : 'VEHICLE_NOT_FOUND';
    return { ok: false, code, message: documentErrorMessage(code) };
  }

  const validation = await validateVehicleDocumentFiles(
    input.files,
    vehicle._count.documents
  );
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      message: validation.message
    };
  }

  const persistedBytes = vehicle.documents.reduce((total, document) => total + document.size, 0);
  const incomingBytes = validation.files.reduce((total, item) => total + item.file.size, 0);
  if (persistedBytes + incomingBytes > MAX_VEHICLE_DOCUMENT_TOTAL_BYTES) {
    return {
      ok: false,
      code: 'DOCUMENT_TOTAL_SIZE_LIMIT_REACHED',
      message: documentErrorMessage('DOCUMENT_TOTAL_SIZE_LIMIT_REACHED')
    };
  }

  const uploads: Array<{
    file: File;
    fileName: string;
    mimeType: string;
    upload: CloudinaryVehicleDocumentUpload;
  }> = [];

  try {
    for (const item of validation.files) {
      uploads.push({
        ...item,
        upload: await uploadVehicleDocument(vehicle.id, item.file)
      });
    }
  } catch {
    return cleanupAfterFailedUpload(uploads, 'DOCUMENT_UPLOAD_FAILED');
  }

  const source = resolveDocumentSourceForActor(input.actor.role);
  const visibleToClient = input.actor.role === 'CLIENT'
    ? true
    : Boolean(input.visibleToClient);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const [count, aggregate] = await Promise.all([
        tx.document.count({ where: { vehicleId: vehicle.id } }),
        tx.document.aggregate({
          where: { vehicleId: vehicle.id },
          _sum: { size: true }
        })
      ]);
      const uploadedBytes = uploads.reduce((total, item) => total + item.upload.bytes, 0);

      if (count + uploads.length > MAX_VEHICLE_DOCUMENTS) {
        throw new VehicleDocumentQuotaError('DOCUMENT_COUNT_LIMIT_REACHED');
      }
      if ((aggregate._sum.size ?? 0) + uploadedBytes > MAX_VEHICLE_DOCUMENT_TOTAL_BYTES) {
        throw new VehicleDocumentQuotaError('DOCUMENT_TOTAL_SIZE_LIMIT_REACHED');
      }

      const rows = await Promise.all(
        uploads.map(({ fileName, mimeType, upload }) => tx.document.create({
          data: {
            vehicleId: vehicle.id,
            fileName,
            storageKey: upload.storageKey,
            fileUrl: null,
            mimeType,
            size: upload.bytes,
            visibleToClient,
            source,
            uploadedById: input.actor.userId
          }
        }))
      );

      await writeAuditLog(tx, {
        actor: auditUserActor(input.actor.userId),
        companyId: vehicle.companyId,
        entityType: 'VEHICLE',
        entityId: vehicle.id,
        action: 'DOCUMENT_UPLOADED',
        category: 'STANDARD',
        metadata: {
          event: 'VEHICLE_DOCUMENT_UPLOADED',
          actorRole: input.actor.role,
          source,
          documents: rows.map((document) => ({
            id: document.id,
            originalName: document.fileName,
            mimeType: document.mimeType,
            size: document.size,
            visibleToClient: document.visibleToClient,
            source: document.source
          }))
        },
        allowedFields: { metadata: AUDIT_METADATA_FIELDS },
        requestContext: input.requestContext
      });

      return rows;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { ok: true, documentIds: created.map((document) => document.id) };
  } catch (error) {
    const code = error instanceof VehicleDocumentQuotaError
      ? error.code
      : 'DOCUMENT_DB_SAVE_FAILED';
    return cleanupAfterFailedUpload(uploads, code);
  }
}

export async function deleteVehicleDocument(input: {
  vehicleId: string;
  documentId: string;
  actor: VehicleDocumentActor;
  requestContext?: AuditRequestContext;
}): Promise<VehicleDocumentServiceResult> {
  const document = await prisma.document.findFirst({
    where: input.actor.role === 'CLIENT'
      ? {
          id: input.documentId,
          vehicleId: input.vehicleId,
          AND: [clientDeletableVehicleDocumentWhere(input.actor)]
        }
      : { id: input.documentId, vehicleId: input.vehicleId },
    select: {
      id: true,
      vehicleId: true,
      vehicle: { select: { companyId: true } },
      storageKey: true,
      fileName: true,
      mimeType: true,
      size: true,
      source: true,
      uploadedById: true,
      visibleToClient: true
    }
  });

  if (!document || !canDeleteVehicleDocument(input.actor, document)) {
    const code = input.actor.role === 'CLIENT' ? 'DOCUMENT_ACCESS_DENIED' : 'DOCUMENT_NOT_FOUND';
    return { ok: false, code, message: documentErrorMessage(code) };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.document.deleteMany({
        where: input.actor.role === 'CLIENT'
          ? {
              id: document.id,
              vehicleId: input.vehicleId,
              source: 'CLIENT',
              uploadedById: input.actor.userId
            }
          : { id: document.id, vehicleId: input.vehicleId }
      });
      if (deleted.count !== 1) {
        throw new Error('Document delete lost authorization race.');
      }

      await writeAuditLog(tx, {
        actor: auditUserActor(input.actor.userId),
        companyId: document.vehicle?.companyId ?? null,
        entityType: 'VEHICLE',
        entityId: input.vehicleId,
        action: 'DOCUMENT_DELETED',
        category: 'STANDARD',
        metadata: {
          event: 'VEHICLE_DOCUMENT_DELETED',
          actorRole: input.actor.role,
          source: document.source,
          documentId: document.id,
          originalName: document.fileName,
          visibleToClient: document.visibleToClient,
          mimeType: document.mimeType,
          size: document.size
        },
        allowedFields: { metadata: AUDIT_METADATA_FIELDS },
        requestContext: input.requestContext
      });
    });
  } catch {
    return {
      ok: false,
      code: 'DOCUMENT_DELETE_FAILED',
      message: documentErrorMessage('DOCUMENT_DELETE_FAILED')
    };
  }

  try {
    await deleteVehicleDocumentAsset(document.storageKey);
  } catch {
    console.error('vehicle_document_delete_asset_cleanup_failed', {
      documentId: document.id,
      vehicleId: input.vehicleId
    });
    return {
      ok: false,
      code: 'DOCUMENT_ASSET_CLEANUP_FAILED',
      message: 'Запис документа видалено, але очищення файла зі сховища потребує повторної обробки.',
      cleanupFailed: true
    };
  }

  return { ok: true, documentIds: [document.id] };
}

export function vehicleDocumentServiceState(
  result: VehicleDocumentServiceResult,
  successMessage: string
): VehicleDocumentActionState {
  return result.ok
    ? { status: 'success', message: successMessage }
    : { status: 'error', message: result.message };
}
