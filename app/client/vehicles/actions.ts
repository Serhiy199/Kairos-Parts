'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { hasDatabaseUrl } from '@/lib/env/database';
import {
  EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
} from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import { findVehicleVinDuplicate } from '@/lib/vehicles/duplicates';
import { vehicleOwnershipForClient } from '@/lib/vehicles/ownership';
import { diffVehicleFields, pickEditableVehicleFields } from '@/lib/vehicles/change-snapshot';
import {
  attachVehicleAssets,
  validateVehicleAssetSelection
} from '@/lib/vehicles/asset-workflow';
import {
  getAdminVehicleFormValues,
  type AdminVehicleFormState,
  validateAdminVehicleForm
} from '@/lib/vehicles/admin-validation';

const VEHICLE_AUDIT_VALUE_FIELDS = ['name', 'type', 'manufacturer', 'model', 'year', 'vinOrSerial', 'comment'] as const;
const VEHICLE_AUDIT_METADATA_FIELDS = ['event', 'actorRole', 'changedFields', 'ownerType', 'ownerId'] as const;
import { buildVehicleDisplayName, VehicleNameBuildError } from '@/lib/vehicles/name';
import { validateEquipmentTaxonomySelection } from '@/lib/vehicles/taxonomy';

function errorState(
  values: ReturnType<typeof getAdminVehicleFormValues>,
  message: string,
  fieldErrors?: AdminVehicleFormState['fieldErrors']
): AdminVehicleFormState {
  return { status: 'error', message, values, fieldErrors };
}

async function validateClientVehicleForm(formData: FormData) {
  const values = getAdminVehicleFormValues(formData);
  const validation = validateAdminVehicleForm(values);
  if (!validation.ok) {
    return {
      ok: false as const,
      state: errorState(values, 'Перевірте поля форми.', validation.fieldErrors)
    };
  }

  const taxonomy = EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
    ? await validateEquipmentTaxonomySelection({
        equipmentType: validation.data.equipmentType,
        manufacturerId: validation.data.manufacturerId
      })
    : null;

  if (taxonomy && !taxonomy.ok) {
    return {
      ok: false as const,
      state: errorState(values, 'Перевірте поля форми.', {
        [taxonomy.field === 'equipmentType' ? 'equipmentType' : 'manufacturerId']: taxonomy.message
      })
    };
  }

  const resolvedManufacturer = taxonomy?.ok
    ? taxonomy.manufacturer.name
    : validation.data.manufacturer;
  let canonicalName;
  try {
    canonicalName = buildVehicleDisplayName({
      manufacturer: resolvedManufacturer,
      model: validation.data.model
    });
  } catch (error) {
    return {
      ok: false as const,
      state: errorState(values, 'Перевірте поля форми.', {
        [error instanceof VehicleNameBuildError && error.code === 'VEHICLE_MANUFACTURER_REQUIRED'
          ? (EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED ? 'manufacturerId' : 'manufacturer')
          : 'model']:
          error instanceof VehicleNameBuildError && error.code === 'VEHICLE_NAME_BUILD_FAILED'
            ? 'Виробник і модель разом не можуть перевищувати 120 символів.'
            : 'Вкажіть виробника та модель.'
      })
    };
  }

  return {
    ok: true as const,
    values,
    data: {
      name: canonicalName.name,
      type: taxonomy?.ok
        ? taxonomy.equipmentType.name
        : validation.data.equipmentType,
      manufacturer: canonicalName.manufacturer,
      model: canonicalName.model,
      year: validation.data.year,
      vinOrSerial: validation.data.vinOrSerial,
      comment: validation.data.comment
    }
  };
}

async function getClientAccess() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    redirect('/client/vehicles?error=database');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/client/vehicles?error=profile');
  }

  return access;
}

export async function createVehicle(
  _state: AdminVehicleFormState,
  formData: FormData
): Promise<AdminVehicleFormState> {
  const access = await getClientAccess();
  const validation = await validateClientVehicleForm(formData);
  if (!validation.ok) {
    return validation.state;
  }

  const assetValidation = await validateVehicleAssetSelection({
    formData,
    existingImageCount: 0,
    existingDocumentCount: 0,
    existingDocumentBytes: 0
  });
  if (!assetValidation.ok) return errorState(validation.values, assetValidation.message);

  const owner = vehicleOwnershipForClient(access);
  const result = await prisma.$transaction(async (tx) => {
    const found = await findVehicleVinDuplicate({ db: tx, owner, normalizedVin: validation.data.vinOrSerial });

    if (found) {
      return { duplicate: found, created: null };
    }

    const created = await tx.vehicle.create({
      data: {
        ...owner,
        ...validation.data
      }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(access.userId),
      companyId: access.companyId,
      entityType: 'VEHICLE',
      entityId: created.id,
      action: 'ENTITY_UPDATED',
      category: 'STANDARD',
      newValue: pickEditableVehicleFields(created),
      metadata: {
        event: 'VEHICLE_CREATED',
        actorRole: 'CLIENT',
        ownerType: access.companyId ? 'company' : 'client',
        ownerId: access.companyId ?? access.clientProfileId
      },
      allowedFields: { newValue: VEHICLE_AUDIT_VALUE_FIELDS, metadata: VEHICLE_AUDIT_METADATA_FIELDS }
    });
    return {
      duplicate: null,
      created: {
        id: created.id,
        clientId: created.clientId,
        companyId: created.companyId,
        images: []
      }
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (result.duplicate) {
    return errorState(validation.values, 'Техніка з таким VIN або серійним номером уже є у вашому парку.', {
      vinOrSerial: 'Перевірте VIN або серійний номер.'
    });
  }

  if (!result.created) {
    return errorState(validation.values, 'Не вдалося створити техніку. Спробуйте ще раз.');
  }

  const assetResult = await attachVehicleAssets({
    vehicle: result.created,
    actor: { userId: access.userId, role: 'CLIENT', access },
    formData,
    selection: assetValidation.selection,
    requestContext: await getServerAuditRequestContext()
  });

  revalidatePath('/client/vehicles');
  redirect(`/client/vehicles/${result.created.id}?created=1${assetResult.ok ? '' : `&assets=partial${assetResult.cleanupFailed ? '&cleanup=failed' : ''}`}`);
}

export async function updateClientVehicle(
  vehicleId: string,
  _state: AdminVehicleFormState,
  formData: FormData
): Promise<AdminVehicleFormState> {
  const access = await getClientAccess();
  const values = getAdminVehicleFormValues(formData);
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, AND: [vehicleAccessWhere(access)] },
    select: {
      id: true,
      name: true,
      clientId: true,
      companyId: true,
      type: true,
      manufacturer: true,
      model: true,
      year: true,
      vinOrSerial: true,
      comment: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, publicId: true, sortOrder: true, isPrimary: true }
      },
      documents: { select: { size: true } }
    }
  });

  if (!vehicle) {
    return errorState(values, 'Техніку не знайдено або вона недоступна.');
  }

  const validation = await validateClientVehicleForm(formData);
  if (!validation.ok) {
    return validation.state;
  }

  const assetValidation = await validateVehicleAssetSelection({
    formData,
    existingImageCount: vehicle.images.length,
    existingDocumentCount: vehicle.documents.length,
    existingDocumentBytes: vehicle.documents.reduce((total, document) => total + document.size, 0)
  });
  if (!assetValidation.ok) return errorState(validation.values, assetValidation.message);

  const owner = vehicleOwnershipForClient(access);
  const duplicate = await prisma.$transaction(async (tx) => {
    const found = await findVehicleVinDuplicate({
      db: tx,
      owner,
      normalizedVin: validation.data.vinOrSerial,
      excludeVehicleId: vehicle.id
    });

    if (found) return found;

    const before = pickEditableVehicleFields(vehicle);
    const updated = await tx.vehicle.update({ where: { id: vehicle.id }, data: validation.data });
    const changes = diffVehicleFields(before, pickEditableVehicleFields(updated));

    if (changes.changedFields.length > 0) {
      await writeAuditLog(tx, {
        actor: auditUserActor(access.userId),
        companyId: access.companyId,
        entityType: 'VEHICLE',
        entityId: vehicle.id,
        action: 'ENTITY_UPDATED',
        category: 'STANDARD',
        oldValue: changes.oldValue,
        newValue: changes.newValue,
        metadata: {
          event: 'VEHICLE_UPDATED',
          actorRole: 'CLIENT',
          changedFields: changes.changedFields,
          ownerType: access.companyId ? 'company' : 'client',
          ownerId: access.companyId ?? access.clientProfileId
        },
        allowedFields: { oldValue: VEHICLE_AUDIT_VALUE_FIELDS, newValue: VEHICLE_AUDIT_VALUE_FIELDS, metadata: VEHICLE_AUDIT_METADATA_FIELDS }
      });
    }

    return null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (duplicate) {
    return errorState(validation.values, 'Техніка з таким VIN або серійним номером уже є у вашому парку.', {
      vinOrSerial: 'Перевірте VIN або серійний номер.'
    });
  }

  const assetResult = await attachVehicleAssets({
    vehicle,
    actor: { userId: access.userId, role: 'CLIENT', access },
    formData,
    selection: assetValidation.selection,
    requestContext: await getServerAuditRequestContext()
  });

  const affectedRequestItems = await prisma.requestItem.findMany({
    where: { vehicleId: vehicle.id },
    select: { requestId: true },
    distinct: ['requestId']
  });
  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  affectedRequestItems.forEach((item) => {
    revalidatePath(`/admin/requests/${item.requestId}`);
  });
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirect(`/client/vehicles/${vehicle.id}?updated=1${assetResult.ok ? '' : `&assets=partial${assetResult.cleanupFailed ? '&cleanup=failed' : ''}`}`);
}
