'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { hasDatabaseUrl } from '@/lib/env/database';
import { hasCloudinaryConfig } from '@/lib/cloudinary/server';
import {
  EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED,
  EQUIPMENT_TEXT_FIELD_MAX_LENGTH
} from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import { findVehicleVinDuplicate } from '@/lib/vehicles/duplicates';
import { vehicleOwnershipForClient } from '@/lib/vehicles/ownership';
import { diffVehicleFields, pickEditableVehicleFields } from '@/lib/vehicles/change-snapshot';
import { uploadVehicleImagesForActor } from '@/lib/vehicles/image-mutations';
import { getVehicleImageFiles, validateVehicleImageFiles } from '@/lib/vehicles/images';
import {
  getAdminVehicleFormValues,
  type AdminVehicleFormState
} from '@/lib/vehicles/admin-validation';
import { normalizeVehicleVin } from '@/lib/vehicles/vin';

const VEHICLE_AUDIT_VALUE_FIELDS = ['name', 'type', 'manufacturer', 'model', 'year', 'vinOrSerial', 'comment'] as const;
const VEHICLE_AUDIT_METADATA_FIELDS = ['event', 'actorRole', 'changedFields', 'ownerType', 'ownerId'] as const;
import { validateVehicleName } from '@/lib/vehicles/name';
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
  const nameResult = validateVehicleName(values.name);
  const equipmentType = values.equipmentType.trim();
  const manufacturerId = values.manufacturerId.trim();
  const manufacturer = values.manufacturer.trim();
  const model = values.model.trim();
  const vinSource = values.vinOrSerial.trim();
  const fieldErrors: AdminVehicleFormState['fieldErrors'] = {};

  if (!nameResult.ok) fieldErrors.name = nameResult.message;

  if (!equipmentType) fieldErrors.equipmentType = 'Вкажіть тип техніки.';
  else if (equipmentType.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    fieldErrors.equipmentType = `Тип техніки має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`;
  }

  if (EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && !manufacturerId) {
    fieldErrors.manufacturerId = 'Оберіть виробника зі списку.';
  } else if (!EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && !manufacturer) {
    fieldErrors.manufacturer = 'Вкажіть виробника або марку.';
  } else if (!EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && manufacturer.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    fieldErrors.manufacturer = `Виробник або марка має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.`;
  }

  if (!model) fieldErrors.model = 'Вкажіть модель.';
  if (vinSource.length > 120) fieldErrors.vinOrSerial = 'VIN або серійний номер має бути не довшим за 120 символів.';

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false as const, state: errorState(values, 'Перевірте поля форми.', fieldErrors) };
  }

  const yearValue = values.year.trim();
  const parsedYear = Number(yearValue);
  const year = yearValue && Number.isInteger(parsedYear) && parsedYear > 1900 && parsedYear < 2200 ? parsedYear : null;

  const taxonomy = EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
    ? await validateEquipmentTaxonomySelection({
        equipmentType,
        manufacturerId
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

  return {
    ok: true as const,
    values,
    data: {
      name: nameResult.ok ? nameResult.name : '',
      type: taxonomy?.ok ? taxonomy.equipmentType.name : equipmentType,
      manufacturer: taxonomy?.ok ? taxonomy.manufacturer.name : manufacturer,
      model,
      year,
      vinOrSerial: normalizeVehicleVin(vinSource),
      comment: values.comment.trim() || null
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

  const imageFiles = getVehicleImageFiles(formData);
  if (imageFiles.length > 0) {
    const imageValidation = validateVehicleImageFiles(imageFiles, 0);
    if (!imageValidation.ok) {
      return errorState(validation.values, imageValidation.message);
    }
    if (!hasCloudinaryConfig()) {
      return errorState(validation.values, 'Сховище фотографій тимчасово недоступне. Спробуйте пізніше або створіть техніку без фото.');
    }
  }

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

  if (imageFiles.length > 0) {
    const uploadResult = await uploadVehicleImagesForActor(
      result.created,
      { userId: access.userId, role: 'CLIENT' },
      formData
    );

    if (uploadResult.status === 'error') {
      redirect(`/client/vehicles/${result.created.id}/photos?created=1&upload=failed`);
    }
  }

  revalidatePath('/client/vehicles');
  redirect('/client/vehicles?created=1');
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
      comment: true
    }
  });

  if (!vehicle) {
    return errorState(values, 'Техніку не знайдено або вона недоступна.');
  }

  const validation = await validateClientVehicleForm(formData);
  if (!validation.ok) {
    return validation.state;
  }

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

  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirect(`/client/vehicles/${vehicle.id}?updated=1`);
}
