'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import {
  attachVehicleAssets,
  validateVehicleAssetSelection
} from '@/lib/vehicles/asset-workflow';
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
import { buildVehicleDisplayName, VehicleNameBuildError } from '@/lib/vehicles/name';
import { validateEquipmentTaxonomySelection } from '@/lib/vehicles/taxonomy';

const GENERIC_ERROR = 'Не вдалося зберегти техніку. Спробуйте ще раз.';
const VEHICLE_AUDIT_VALUE_FIELDS = ['name', 'type', 'manufacturer', 'model', 'year', 'vinOrSerial', 'comment'] as const;
const VEHICLE_AUDIT_METADATA_FIELDS = ['event', 'actorRole', 'changedFields', 'ownerType', 'ownerId'] as const;

function crmActorRole(role: string): 'ADMIN' | 'MANAGER' {
  if (role === 'ADMIN' || role === 'MANAGER') return role;
  throw new Error('CRM_ROLE_REQUIRED');
}

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

  const type = manufacturerResult?.ok ? manufacturerResult.equipmentType.name : validation.data.equipmentType;
  const manufacturer = manufacturerResult?.ok ? manufacturerResult.manufacturer.name : validation.data.manufacturer;
  let canonicalName;
  try {
    canonicalName = buildVehicleDisplayName({
      manufacturer,
      model: validation.data.model
    });
  } catch (error) {
    const field = error instanceof VehicleNameBuildError && error.code === 'VEHICLE_MANUFACTURER_REQUIRED'
      ? (EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED ? 'manufacturerId' : 'manufacturer')
      : 'model';
    return {
      ok: false as const,
      state: errorState(values, 'Перевірте поля форми.', {
        [field]: error instanceof VehicleNameBuildError && error.code === 'VEHICLE_NAME_BUILD_FAILED'
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
      type,
      manufacturer: canonicalName.manufacturer,
      model: canonicalName.model,
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
  const assetValidation = await validateVehicleAssetSelection({
    formData,
    existingImageCount: 0,
    existingDocumentCount: 0,
    existingDocumentBytes: 0
  });
  if (!assetValidation.ok) return errorState(validation.values, assetValidation.message);

  let createdVehicle: { id: string; clientId: string | null; companyId: string | null; images: [] } | null = null;
  try {
    const owner = vehicleOwnershipForCompany(company.id);
    const result = await prisma.$transaction(async (tx) => {
      const found = await findVehicleVinDuplicate({
        db: tx,
        owner,
        normalizedVin: validation.data.vinOrSerial
      });

      if (found) {
        return { duplicate: found, created: null };
      }

      const created = await tx.vehicle.create({ data: { ...owner, ...validation.data } });
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        companyId: company.id,
        entityType: 'VEHICLE',
        entityId: created.id,
        action: 'ENTITY_UPDATED',
        category: 'STANDARD',
        newValue: pickEditableVehicleFields(created),
        metadata: { event: 'VEHICLE_CREATED', actorRole: session.user.role, ownerType: 'company', ownerId: company.id },
        allowedFields: { newValue: VEHICLE_AUDIT_VALUE_FIELDS, metadata: VEHICLE_AUDIT_METADATA_FIELDS }
      });
      return {
        duplicate: null,
        created: { id: created.id, clientId: created.clientId, companyId: created.companyId, images: [] as [] }
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.duplicate) {
      return duplicateState(validation.values, result.duplicate.id);
    }
    createdVehicle = result.created;
  } catch {
    return errorState(validation.values);
  }

  if (!createdVehicle) return errorState(validation.values);
  const assetResult = await attachVehicleAssets({
    vehicle: createdVehicle,
    actor: { userId: session.user.id, role: crmActorRole(session.user.role) },
    formData,
    selection: assetValidation.selection,
    visibleToClient: formData.get('visibleToClient') === 'on',
    requestContext: await getServerAuditRequestContext()
  });
  revalidatePath(`/admin/companies/${company.id}`);
  revalidatePath('/client/vehicles');
  redirect(`/admin/vehicles/${createdVehicle.id}/edit?created=1${assetResult.ok ? '' : `&assets=partial${assetResult.cleanupFailed ? '&cleanup=failed' : ''}`}`);
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
  const assetValidation = await validateVehicleAssetSelection({
    formData,
    existingImageCount: 0,
    existingDocumentCount: 0,
    existingDocumentBytes: 0
  });
  if (!assetValidation.ok) return errorState(validation.values, assetValidation.message);

  let createdVehicle: { id: string; clientId: string | null; companyId: string | null; images: [] } | null = null;
  try {
    const owner = vehicleOwnershipForPersonalClient(client.id);
    const result = await prisma.$transaction(async (tx) => {
      const found = await findVehicleVinDuplicate({
        db: tx,
        owner,
        normalizedVin: validation.data.vinOrSerial
      });

      if (found) {
        return { duplicate: found, created: null };
      }

      const created = await tx.vehicle.create({ data: { ...owner, ...validation.data } });
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        entityType: 'VEHICLE',
        entityId: created.id,
        action: 'ENTITY_UPDATED',
        category: 'STANDARD',
        newValue: pickEditableVehicleFields(created),
        metadata: { event: 'VEHICLE_CREATED', actorRole: session.user.role, ownerType: 'client', ownerId: client.id },
        allowedFields: { newValue: VEHICLE_AUDIT_VALUE_FIELDS, metadata: VEHICLE_AUDIT_METADATA_FIELDS }
      });
      return {
        duplicate: null,
        created: { id: created.id, clientId: created.clientId, companyId: created.companyId, images: [] as [] }
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.duplicate) {
      return duplicateState(validation.values, result.duplicate.id);
    }
    createdVehicle = result.created;
  } catch {
    return errorState(validation.values);
  }

  if (!createdVehicle) return errorState(validation.values);
  const assetResult = await attachVehicleAssets({
    vehicle: createdVehicle,
    actor: { userId: session.user.id, role: crmActorRole(session.user.role) },
    formData,
    selection: assetValidation.selection,
    visibleToClient: formData.get('visibleToClient') === 'on',
    requestContext: await getServerAuditRequestContext()
  });
  revalidatePath(`/admin/clients/${client.id}`);
  revalidatePath('/client/vehicles');
  redirect(`/admin/vehicles/${createdVehicle.id}/edit?created=1${assetResult.ok ? '' : `&assets=partial${assetResult.cleanupFailed ? '&cleanup=failed' : ''}`}`);
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
      comment: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, publicId: true, sortOrder: true, isPrimary: true }
      },
      documents: { select: { size: true } }
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
  const assetValidation = await validateVehicleAssetSelection({
    formData,
    existingImageCount: vehicle.images.length,
    existingDocumentCount: vehicle.documents.length,
    existingDocumentBytes: vehicle.documents.reduce((total, document) => total + document.size, 0)
  });
  if (!assetValidation.ok) return errorState(validation.values, assetValidation.message);

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
        await writeAuditLog(tx, {
          actor: auditUserActor(session.user.id),
          companyId: vehicle.companyId,
          entityType: 'VEHICLE',
          entityId: vehicle.id,
          action: 'ENTITY_UPDATED',
          category: 'STANDARD',
          oldValue: changes.oldValue,
          newValue: changes.newValue,
          metadata: {
            event: 'VEHICLE_UPDATED',
            actorRole: session.user.role,
            changedFields: changes.changedFields,
            ownerType: vehicle.companyId ? 'company' : 'client',
            ownerId: vehicle.companyId ?? vehicle.clientId
          },
          allowedFields: { oldValue: VEHICLE_AUDIT_VALUE_FIELDS, newValue: VEHICLE_AUDIT_VALUE_FIELDS, metadata: VEHICLE_AUDIT_METADATA_FIELDS }
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

  const assetResult = await attachVehicleAssets({
    vehicle,
    actor: { userId: session.user.id, role: crmActorRole(session.user.role) },
    formData,
    selection: assetValidation.selection,
    visibleToClient: formData.get('visibleToClient') === 'on',
    requestContext: await getServerAuditRequestContext()
  });

  const ownerProfilePath = vehicle.companyId
    ? `/admin/companies/${vehicle.companyId}`
    : `/admin/clients/${vehicle.clientId}`;
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
  revalidatePath(ownerProfilePath);
  revalidatePath(`/admin/vehicles/${vehicle.id}/edit`);
  revalidatePath('/client/vehicles');
  revalidatePath(`/client/vehicles/${vehicle.id}`);
  redirect(`/admin/vehicles/${vehicle.id}/edit?updated=1${assetResult.ok ? '' : `&assets=partial${assetResult.cleanupFailed ? '&cleanup=failed' : ''}`}`);
}
