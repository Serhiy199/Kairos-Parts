'use server';

import type { UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { requireCrmSession } from '@/lib/admin/access';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { hasCloudinaryConfig } from '@/lib/cloudinary/server';
import { prisma } from '@/lib/prisma';
import {
  createVehicleDocument,
  deleteVehicleDocument,
  vehicleDocumentServiceState
} from '@/lib/vehicles/document-service';
import {
  getVehicleDocumentFiles,
  type VehicleDocumentActionState
} from '@/lib/vehicles/documents';

const VEHICLE_DOCUMENT_AUDIT_METADATA_FIELDS = [
  'event', 'actorRole', 'source', 'documents', 'documentId', 'originalName',
  'visibleToClient', 'mimeType', 'size'
] as const;

function crmDocumentActorRole(role: UserRole): 'MANAGER' | 'ADMIN' {
  if (role === 'MANAGER' || role === 'ADMIN') return role;
  throw new Error('CRM document action requires a staff actor.');
}

async function getVehicleDocumentContext(vehicleId: string) {
  return prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      clientId: true,
      companyId: true
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
  const requestContext = await getServerAuditRequestContext();
  const vehicle = await getVehicleDocumentContext(vehicleId);

  if (!vehicle) return { status: 'error', message: 'Техніку не знайдено.' };

  const files = getVehicleDocumentFiles(formData);

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' };
  }

  const visibleToClient = formData.get('visibleToClient') === 'on';
  const result = await createVehicleDocument({
    vehicleId: vehicle.id,
    actor: {
      userId: session.user.id,
      role: crmDocumentActorRole(session.user.role)
    },
    files,
    visibleToClient,
    requestContext
  });
  if (!result.ok) return vehicleDocumentServiceState(result, 'Документи завантажено.');

  revalidateVehicleDocumentPaths(vehicle);
  return { status: 'success', message: 'Документи завантажено.' };
}

export async function setVehicleDocumentVisibility(vehicleId: string, documentId: string, visibleToClient: boolean) {
  const session = await requireCrmSession();
  const requestContext = await getServerAuditRequestContext();
  const vehicle = await getVehicleDocumentContext(vehicleId);
  const document = vehicle
    ? await prisma.document.findFirst({
        where: { id: documentId, vehicleId: vehicle.id },
        select: { id: true, visibleToClient: true, source: true }
      })
    : null;

  if (!vehicle || !document) {
    return { status: 'error', message: 'Документ не знайдено.' } satisfies VehicleDocumentActionState;
  }
  if (document.visibleToClient === visibleToClient) {
    return { status: 'success', message: 'Видимість документа не змінилася.' } satisfies VehicleDocumentActionState;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: document.id }, data: { visibleToClient } });
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id), companyId: vehicle.companyId, entityType: 'VEHICLE', entityId: vehicle.id,
        action: 'DOCUMENT_VISIBILITY_CHANGED', category: 'STANDARD', oldValue: { visibleToClient: document.visibleToClient }, newValue: { visibleToClient },
        metadata: {
          event: 'VEHICLE_DOCUMENT_VISIBILITY_CHANGED',
          actorRole: session.user.role,
          source: document.source,
          documentId: document.id
        },
        allowedFields: { oldValue: ['visibleToClient'], newValue: ['visibleToClient'], metadata: VEHICLE_DOCUMENT_AUDIT_METADATA_FIELDS },
        requestContext
      });
    });
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
  const session = await requireCrmSession();
  const requestContext = await getServerAuditRequestContext();
  const vehicle = await getVehicleDocumentContext(vehicleId);
  if (!vehicle) {
    return { status: 'error', message: 'Документ не знайдено.' } satisfies VehicleDocumentActionState;
  }

  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' } satisfies VehicleDocumentActionState;
  }

  const result = await deleteVehicleDocument({
    vehicleId: vehicle.id,
    documentId,
    actor: {
      userId: session.user.id,
      role: crmDocumentActorRole(session.user.role)
    },
    requestContext
  });
  if (!result.ok) return vehicleDocumentServiceState(result, 'Документ видалено.');

  revalidateVehicleDocumentPaths(vehicle);
  return { status: 'success', message: 'Документ видалено.' } satisfies VehicleDocumentActionState;
}
