'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { createAuditLog } from '@/lib/audit-log/service';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import {
  getAdminVehicleFormValues,
  type AdminVehicleFormState,
  validateAdminVehicleForm
} from '@/lib/vehicles/admin-validation';
import {
  findVehicleVinDuplicate,
  VEHICLE_VIN_DUPLICATE_MESSAGE
} from '@/lib/vehicles/duplicates';
import {
  isValidVehicleOwnership,
  type VehicleOwnership,
  vehicleOwnershipForCompany,
  vehicleOwnershipForPersonalClient
} from '@/lib/vehicles/ownership';
import { diffVehicleFields, pickEditableVehicleFields } from '@/lib/vehicles/change-snapshot';
import { validateEquipmentTaxonomySelection } from '@/lib/vehicles/taxonomy';

const GENERIC_ERROR = 'Не вдалося зберегти техніку. Спробуйте ще раз.';

function errorState(
  values: ReturnType<typeof getAdminVehicleFormValues>,
  message = GENERIC_ERROR,
  fieldErrors?: AdminVehicleFormState['fieldErrors'],
  duplicateVehicleId?: string
): AdminVehicleFormState {
  return {
    status: 'error',
    message,
    values,
    fieldErrors,
    duplicateVehicleId
  };
}

function duplicateState(values: ReturnType<typeof getAdminVehicleFormValues>, duplicateVehicleId: string) {
  return errorState(
    values,
    VEHICLE_VIN_DUPLICATE_MESSAGE,
    { vinOrSerial: VEHICLE_VIN_DUPLICATE_MESSAGE },
    duplicateVehicleId
  );
}

async function validateForm(formData: FormData) {
  const values = getAdminVehicleFormValues(formData);
  const validation = validateAdminVehicleForm(values);

  if (!validation.ok) {
    return {
      ok: false as const,
      state: errorState(values, 'Перевірте поля форми.', validation.fieldErrors)
    };
  }

  const manufacturerResult = EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
    ? await validateEquipmentTaxonomySelection({
        equipmentType: validation.data.equipmentType,
        manufacturerId: validation.data.manufacturerId
      })
    : null;

  if (manufacturerResult && !manufacturerResult.ok) {
    return {
      ok: false as const,
      state: errorState(values, 'Перевірте поля форми.', {
        [manufacturerResult.field === 'equipmentType' ? 'equipmentType' : 'manufacturerId']: manufacturerResult.message
      })
    };
  }

  return {
    ok: true as const,
    values,
    data: {
      name: validation.data.name,
      type: manufacturerResult?.ok ? manufacturerResult.equipmentType.name : validation.data.equipmentType,
      manufacturer: manufacturerResult?.ok ? manufacturerResult.manufacturer.name : validation.data.manufacturer,
      model: validation.data.model,
      year: validation.data.year,
      vinOrSerial: validation.data.vinOrSerial,
      comment: validation.data.comment
    }
  };
}

export async function createAdminVehicleForCompany(
  companyId: string,
  _state: AdminVehicleFormState,
  formData: FormData
): Promise<AdminVehicleFormState> {
  const session = await requireCrmSession();
  const values = getAdminVehicleFormValues(formData);

  if (!hasDatabaseUrl()) {
    return errorState(values, 'База даних тимчасово недоступна.');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true }
  });

  if (!company) {
    return errorState(values, 'Компанію не знайдено.');
  }

  const validation = await validateForm(formData);
  if (!validation.ok) {
    return validation.state;
  }

  let createdVehicleId = '';
  try {
    const owner = vehicleOwnershipForCompany(company.id);
    const result = await prisma.$transaction(async (tx) => {
      const found = await findVehicleVinDuplicate({
        db: tx,
        owner,
        normalizedVin: validation.data.vinOrSerial
      });

      if (found) {
        return { duplicate: found, createdId: null };
      }

      const created = await tx.vehicle.create({ data: { ...owner, ...validation.data } });
      await createAuditLog(tx, {
        actorId: session.user.id,
        companyId: company.id,
        entityType: 'VEHICLE',
        entityId: created.id,
        action: 'ENTITY_UPDATED',
        newValue: pickEditableVehicleFields(created),
        metadata: { event: 'VEHICLE_CREATED', actorRole: session.user.role, ownerType: 'company', ownerId: company.id }
      });
      return { duplicate: null, createdId: created.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.duplicate) {
      return duplicateState(validation.values, result.duplicate.id);
    }
    createdVehicleId = result.createdId;
  } catch {
    return errorState(validation.values);
  }

  revalidatePath(`/admin/companies/${company.id}`);
  revalidatePath('/client/vehicles');
  redirect(`/admin/vehicles/${createdVehicleId}/edit?created=1#photos`);
}

export async function createAdminVehicleForClient(
  clientId: string,
  _state: AdminVehicleFormState,
  formData: FormData
): Promise<AdminVehicleFormState> {
  const session = await requireCrmSession();
  const values = getAdminVehicleFormValues(formData);

  if (!hasDatabaseUrl()) {
    return errorState(values, 'База даних тимчасово недоступна.');
  }

  const client = await prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      user: { role: 'CLIENT' }
    },
    select: { id: true }
  });

  if (!client) {
    return errorState(values, 'Клієнта не знайдено.');
  }

  const validation = await validateForm(formData);
  if (!validation.ok) {
    return validation.state;
  }

  let createdVehicleId = '';
  try {
    const owner = vehicleOwnershipForPersonalClient(client.id);
    const result = await prisma.$transaction(async (tx) => {
      const found = await findVehicleVinDuplicate({
        db: tx,
        owner,
        normalizedVin: validation.data.vinOrSerial
      });

      if (found) {
        return { duplicate: found, createdId: null };
      }

      const created = await tx.vehicle.create({ data: { ...owner, ...validation.data } });
      await createAuditLog(tx, {
        actorId: session.user.id,
        entityType: 'VEHICLE',
        entityId: created.id,
        action: 'ENTITY_UPDATED',
        newValue: pickEditableVehicleFields(created),
        metadata: { event: 'VEHICLE_CREATED', actorRole: session.user.role, ownerType: 'client', ownerId: client.id }
      });
      return { duplicate: null, createdId: created.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.duplicate) {
      return duplicateState(validation.values, result.duplicate.id);
    }
    createdVehicleId = result.createdId;
  } catch {
    return errorState(validation.values);
  }

  revalidatePath(`/admin/clients/${client.id}`);
  revalidatePath('/client/vehicles');
  redirect(`/admin/vehicles/${createdVehicleId}/edit?created=1#photos`);
}

export async function updateAdminVehicle(
  vehicleId: string,
  _state: AdminVehicleFormState,
  formData: FormData
): Promise<AdminVehicleFormState> {
  const session = await requireCrmSession();
  const values = getAdminVehicleFormValues(formData);

  if (!hasDatabaseUrl()) {
    return errorState(values, 'База даних тимчасово недоступна.');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      name: true,
      clientId: true,
      companyId: true,
      client: {
        select: {
          id: true,
          user: { select: { role: true } }
        }
      },
      company: { select: { id: true } },
      type: true,
      manufacturer: true,
      model: true,
      year: true,
      vinOrSerial: true,
      comment: true
    }
  });

  if (
    !vehicle ||
    !isValidVehicleOwnership(vehicle) ||
    (vehicle.clientId !== null && (!vehicle.client || vehicle.client.user.role !== 'CLIENT')) ||
    (vehicle.companyId !== null && !vehicle.company)
  ) {
    return errorState(values, 'Техніку або її власника не знайдено.');
  }

  const validation = await validateForm(formData);
  if (!validation.ok) {
    return validation.state;
  }

  try {
    const owner: VehicleOwnership = vehicle.companyId
      ? vehicleOwnershipForCompany(vehicle.companyId)
      : vehicleOwnershipForPersonalClient(vehicle.clientId as string);
    const duplicate = await prisma.$transaction(async (tx) => {
      const found = await findVehicleVinDuplicate({
        db: tx,
        owner,
        normalizedVin: validation.data.vinOrSerial,
        excludeVehicleId: vehicle.id
      });

      if (found) {
        return found;
      }

      const before = pickEditableVehicleFields(vehicle);
      const updated = await tx.vehicle.update({ where: { id: vehicle.id }, data: validation.data });
      const changes = diffVehicleFields(before, pickEditableVehicleFields(updated));

      if (changes.changedFields.length > 0) {
        await createAuditLog(tx, {
          actorId: session.user.id,
          companyId: vehicle.companyId,
          entityType: 'VEHICLE',
          entityId: vehicle.id,
          action: 'ENTITY_UPDATED',
          oldValue: changes.oldValue,
          newValue: changes.newValue,
          metadata: {
            event: 'VEHICLE_UPDATED',
            actorRole: session.user.role,
            changedFields: changes.changedFields,
            ownerType: vehicle.companyId ? 'company' : 'client',
            ownerId: vehicle.companyId ?? vehicle.clientId
          }
        });
      }
      return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (duplicate) {
      return duplicateState(validation.values, duplicate.id);
    }
  } catch {
    return errorState(validation.values);
  }

  const ownerProfilePath = vehicle.companyId
    ? `/admin/companies/${vehicle.companyId}`
    : `/admin/clients/${vehicle.clientId}`;

  revalidatePath(ownerProfilePath);
  revalidatePath(`/admin/vehicles/${vehicle.id}/edit`);
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirect(`${ownerProfilePath}#fleet`);
}
