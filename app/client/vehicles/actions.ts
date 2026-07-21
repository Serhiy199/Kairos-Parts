'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { createAuditLog } from '@/lib/audit-log/service';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import { findVehicleVinDuplicate } from '@/lib/vehicles/duplicates';
import { vehicleOwnershipForClient } from '@/lib/vehicles/ownership';
import { diffVehicleFields, pickEditableVehicleFields } from '@/lib/vehicles/change-snapshot';
import {
  getAdminVehicleFormValues,
  type AdminVehicleFormState,
  validateAdminVehicleForm
} from '@/lib/vehicles/admin-validation';
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
    return { ok: false as const, state: errorState(values, 'Перевірте поля форми.', validation.fieldErrors) };
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

  return {
    ok: true as const,
    values,
    data: {
      type: taxonomy?.ok ? taxonomy.equipmentType.name : validation.data.equipmentType,
      manufacturer: taxonomy?.ok ? taxonomy.manufacturer.name : validation.data.manufacturer,
      model: validation.data.model,
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

  const owner = vehicleOwnershipForClient(access);
  const result = await prisma.$transaction(async (tx) => {
    const found = await findVehicleVinDuplicate({ db: tx, owner, normalizedVin: validation.data.vinOrSerial });

    if (found) {
      return { duplicate: found, createdId: null };
    }

    const created = await tx.vehicle.create({
      data: {
        ...owner,
        ...validation.data
      }
    });
    await createAuditLog(tx, {
      actorId: access.userId,
      companyId: access.companyId,
      entityType: 'VEHICLE',
      entityId: created.id,
      action: 'ENTITY_UPDATED',
      newValue: pickEditableVehicleFields(created),
      metadata: {
        event: 'VEHICLE_CREATED',
        actorRole: 'CLIENT',
        ownerType: access.companyId ? 'company' : 'client',
        ownerId: access.companyId ?? access.clientProfileId
      }
    });
    return { duplicate: null, createdId: created.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (result.duplicate) {
    return errorState(validation.values, 'Техніка з таким VIN або серійним номером уже є у вашому парку.', {
      vinOrSerial: 'Перевірте VIN або серійний номер.'
    });
  }

  revalidatePath('/client/vehicles');
  redirect(`/client/vehicles/${result.createdId}/photos?created=1`);
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
      await createAuditLog(tx, {
        actorId: access.userId,
        companyId: access.companyId,
        entityType: 'VEHICLE',
        entityId: vehicle.id,
        action: 'ENTITY_UPDATED',
        oldValue: changes.oldValue,
        newValue: changes.newValue,
        metadata: {
          event: 'VEHICLE_UPDATED',
          actorRole: 'CLIENT',
          changedFields: changes.changedFields,
          ownerType: access.companyId ? 'company' : 'client',
          ownerId: access.companyId ?? access.clientProfileId
        }
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
