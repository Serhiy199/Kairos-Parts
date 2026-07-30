'use server';

import { revalidatePath } from 'next/cache';

import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import {
  getClientAccessContext,
  requireClientSession
} from '@/lib/client/access';
import { hasCloudinaryConfig } from '@/lib/cloudinary/server';
import {
  createVehicleDocument,
  deleteVehicleDocument,
  vehicleDocumentServiceState
} from '@/lib/vehicles/document-service';
import {
  getVehicleDocumentFiles,
  type VehicleDocumentActionState
} from '@/lib/vehicles/documents';

function revalidateClientVehicleDocumentPaths(vehicleId: string) {
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicleId}`);
  revalidatePath('/client/documents');
  revalidatePath(`/admin/vehicles/${vehicleId}/edit`);
}

async function getClientActor() {
  const session = await requireClientSession();
  const access = await getClientAccessContext(session.user.id);
  return access
    ? {
        userId: session.user.id,
        role: 'CLIENT' as const,
        access
      }
    : null;
}

export async function uploadClientVehicleDocuments(
  vehicleId: string,
  _state: VehicleDocumentActionState,
  formData: FormData
): Promise<VehicleDocumentActionState> {
  const actor = await getClientActor();
  if (!actor) return { status: 'error', message: 'Профіль клієнта не знайдено.' };
  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' };
  }

  const result = await createVehicleDocument({
    vehicleId,
    actor,
    files: getVehicleDocumentFiles(formData),
    // The service also forces this value for CLIENT actors.
    visibleToClient: true,
    requestContext: await getServerAuditRequestContext()
  });
  if (!result.ok) return vehicleDocumentServiceState(result, 'Документи завантажено.');

  revalidateClientVehicleDocumentPaths(vehicleId);
  return { status: 'success', message: 'Документи завантажено.' };
}

export async function deleteClientVehicleDocument(
  vehicleId: string,
  documentId: string
): Promise<VehicleDocumentActionState> {
  const actor = await getClientActor();
  if (!actor) return { status: 'error', message: 'Профіль клієнта не знайдено.' };
  if (!hasCloudinaryConfig()) {
    return { status: 'error', message: 'Сховище документів тимчасово недоступне.' };
  }

  const result = await deleteVehicleDocument({
    vehicleId,
    documentId,
    actor,
    requestContext: await getServerAuditRequestContext()
  });
  if (!result.ok) return vehicleDocumentServiceState(result, 'Документ видалено.');

  revalidateClientVehicleDocumentPaths(vehicleId);
  return { status: 'success', message: 'Документ видалено.' };
}
