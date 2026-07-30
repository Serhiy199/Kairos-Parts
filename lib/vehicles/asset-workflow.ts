import 'server-only';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { hasCloudinaryConfig } from '@/lib/cloudinary/server';
import type { ClientAccessContext } from '@/lib/client/access';
import { createVehicleDocument } from '@/lib/vehicles/document-service';
import {
  getVehicleDocumentFiles,
  MAX_VEHICLE_DOCUMENT_TOTAL_BYTES,
  validateVehicleDocumentFiles
} from '@/lib/vehicles/documents';
import {
  uploadVehicleImagesForActor,
  type VehiclePhotoContext
} from '@/lib/vehicles/image-mutations';
import { getVehicleImageFiles, validateVehicleImageFiles } from '@/lib/vehicles/images';

type StaffActor = { userId: string; role: 'ADMIN' | 'MANAGER' };
type ClientActor = { userId: string; role: 'CLIENT'; access: ClientAccessContext };
export type VehicleAssetActor = StaffActor | ClientActor;

export type VehicleAssetSelection = {
  imageFiles: File[];
  documentFiles: File[];
};

export async function validateVehicleAssetSelection(input: {
  formData: FormData;
  existingImageCount: number;
  existingDocumentCount: number;
  existingDocumentBytes: number;
}): Promise<
  | { ok: true; selection: VehicleAssetSelection }
  | { ok: false; message: string }
> {
  const imageFiles = getVehicleImageFiles(input.formData);
  const documentFiles = getVehicleDocumentFiles(input.formData);

  if (imageFiles.length > 0) {
    const validation = validateVehicleImageFiles(imageFiles, input.existingImageCount);
    if (!validation.ok) return { ok: false, message: validation.message };
  }

  if (documentFiles.length > 0) {
    const validation = await validateVehicleDocumentFiles(
      documentFiles,
      input.existingDocumentCount
    );
    if (!validation.ok) return { ok: false, message: validation.message };
    const incomingBytes = documentFiles.reduce((total, file) => total + file.size, 0);
    if (input.existingDocumentBytes + incomingBytes > MAX_VEHICLE_DOCUMENT_TOTAL_BYTES) {
      return {
        ok: false,
        message: 'Загальний розмір документів для однієї одиниці техніки не може перевищувати 250 МБ.'
      };
    }
  }

  if ((imageFiles.length > 0 || documentFiles.length > 0) && !hasCloudinaryConfig()) {
    return {
      ok: false,
      message: 'Сховище файлів тимчасово недоступне. Спробуйте пізніше або збережіть форму без нових файлів.'
    };
  }

  return { ok: true, selection: { imageFiles, documentFiles } };
}

export async function attachVehicleAssets(input: {
  vehicle: VehiclePhotoContext;
  actor: VehicleAssetActor;
  formData: FormData;
  selection: VehicleAssetSelection;
  visibleToClient?: boolean;
  requestContext?: AuditRequestContext;
}) {
  let imagesAttached = false;
  if (input.selection.imageFiles.length > 0) {
    const imageResult = await uploadVehicleImagesForActor(
      input.vehicle,
      { userId: input.actor.userId, role: input.actor.role },
      input.formData
    );
    if (imageResult.status === 'error') {
      return { ok: false as const, partial: false, message: imageResult.message };
    }
    imagesAttached = true;
  }

  if (input.selection.documentFiles.length > 0) {
    const documentResult = await createVehicleDocument({
      vehicleId: input.vehicle.id,
      actor: input.actor,
      files: input.selection.documentFiles,
      visibleToClient: input.visibleToClient,
      requestContext: input.requestContext
    });
    if (!documentResult.ok) {
      return {
        ok: false as const,
        partial: imagesAttached,
        message: documentResult.message,
        cleanupFailed: documentResult.cleanupFailed
      };
    }
  }

  return { ok: true as const };
}
