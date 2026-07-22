import type { AuditAction, AuditEntityType, ChangeRequest, Prisma } from '@prisma/client';

import {
  EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED,
  EQUIPMENT_TEXT_FIELD_MAX_LENGTH
} from '@/lib/features/equipment-taxonomy';
import { findVehicleVinDuplicate } from '@/lib/vehicles/duplicates';
import { isValidVehicleOwnership } from '@/lib/vehicles/ownership';
import { normalizeTaxonomyName } from '@/lib/vehicles/taxonomy-normalization';
import {
  isEditableVehicleField,
  normalizeEditableVehicleValue,
  pickEditableVehicleFields,
  readChangeValue
} from '@/lib/vehicles/change-snapshot';

type ApplyableChangeRequest = Pick<ChangeRequest, 'entityType' | 'entityId' | 'action' | 'fieldName' | 'oldValue' | 'newValue' | 'companyId' | 'requestedById'>;

type ApplyResult =
  | { ok: true; audit: AppliedChangeAudit }
  | {
      ok: false;
      status:
        | 'change-request-unsupported-apply'
        | 'change-request-field-not-allowed'
        | 'change-request-new-value-required'
        | 'change-request-invalid-value'
        | 'change-request-stale-conflict'
        | 'change-request-vehicle-vin-duplicate'
        | 'change-request-target-not-found-or-forbidden';
    };

type AppliedChangeAudit = {
  entityType: AuditEntityType;
  entityId: string;
  action: Extract<AuditAction, 'CHANGE_APPLIED' | 'VEHICLE_ARCHIVED' | 'ENTITY_UPDATED'>;
  oldValue: Prisma.InputJsonValue;
  newValue: Prisma.InputJsonValue;
  metadata: Prisma.InputJsonValue;
};

const REQUEST_FIELD_ALIASES = {
  description: 'description',
  equipmentType: 'equipmentType',
  vehicleType: 'equipmentType',
  model: 'model',
  vinOrSerial: 'vinOrSerial',
  vin: 'vinOrSerial',
  serialNumber: 'vinOrSerial'
} as const;

const REQUEST_ITEM_FIELD_ALIASES = {
  name: 'name',
  brand: 'brand',
  catalogNumber: 'catalogNumber',
  analogNumber: 'analogNumber',
  quantity: 'quantity',
  unit: 'unit',
  comment: 'comment'
} as const;

const VEHICLE_FIELD_ALIASES = {
  name: 'name',
  type: 'type',
  brand: 'manufacturer',
  manufacturer: 'manufacturer',
  model: 'model',
  year: 'year',
  vin: 'vinOrSerial',
  serialNumber: 'vinOrSerial',
  vinOrSerial: 'vinOrSerial',
  comment: 'comment'
} as const;

type RequestField = (typeof REQUEST_FIELD_ALIASES)[keyof typeof REQUEST_FIELD_ALIASES];
type RequestItemField = (typeof REQUEST_ITEM_FIELD_ALIASES)[keyof typeof REQUEST_ITEM_FIELD_ALIASES];
type VehicleField = (typeof VEHICLE_FIELD_ALIASES)[keyof typeof VEHICLE_FIELD_ALIASES];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractNewValue(changeRequest: ApplyableChangeRequest, normalizedField: string) {
  const value = changeRequest.newValue;

  if (value === null || value === undefined) {
    return undefined;
  }

  if (isObject(value)) {
    if (Object.prototype.hasOwnProperty.call(value, normalizedField)) {
      return value[normalizedField];
    }

    if (changeRequest.fieldName && Object.prototype.hasOwnProperty.call(value, changeRequest.fieldName)) {
      return value[changeRequest.fieldName];
    }

    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return value.text;
    }
  }

  return value;
}

function readText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const text = String(value).trim();

  if (!text || text.length > maxLength) {
    return null;
  }

  return text;
}

function readPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function normalizeRequestField(fieldName: string | null): RequestField | null {
  if (!fieldName) {
    return null;
  }

  return REQUEST_FIELD_ALIASES[fieldName as keyof typeof REQUEST_FIELD_ALIASES] ?? null;
}

function normalizeRequestItemField(fieldName: string | null): RequestItemField | null {
  if (!fieldName) {
    return null;
  }

  return REQUEST_ITEM_FIELD_ALIASES[fieldName as keyof typeof REQUEST_ITEM_FIELD_ALIASES] ?? null;
}

function normalizeVehicleField(fieldName: string | null): VehicleField | null {
  if (!fieldName) {
    return null;
  }

  return VEHICLE_FIELD_ALIASES[fieldName as keyof typeof VEHICLE_FIELD_ALIASES] ?? null;
}

function requestUpdateData(field: RequestField, value: unknown): Prisma.RequestUpdateInput | null {
  const maxLength = field === 'description' ? 5000 : 500;
  const text = readText(value, maxLength);

  if (!text) {
    return null;
  }

  return { [field]: text };
}

function requestItemUpdateData(field: RequestItemField, value: unknown): Prisma.RequestItemUpdateInput | null {
  if (field === 'quantity') {
    const quantity = readPositiveInteger(value);
    return quantity ? { quantity } : null;
  }

  const text = readText(value, 500);

  if (!text) {
    return null;
  }

  return { [field]: text };
}

function vehicleUpdateData(field: VehicleField, value: unknown): Prisma.VehicleUpdateInput | null {
  const normalized = normalizeEditableVehicleValue(field, value);
  return normalized === undefined ? null : { [field]: normalized };
}

export async function applyChangeRequest(tx: Prisma.TransactionClient, changeRequest: ApplyableChangeRequest, reviewedById: string): Promise<ApplyResult> {
  if (changeRequest.entityType === 'REQUEST' && changeRequest.action === 'UPDATE') {
    const field = normalizeRequestField(changeRequest.fieldName);

    if (!field) {
      return { ok: false, status: 'change-request-field-not-allowed' };
    }

    const data = requestUpdateData(field, extractNewValue(changeRequest, field));

    if (!data) {
      return { ok: false, status: changeRequest.newValue == null ? 'change-request-new-value-required' : 'change-request-invalid-value' };
    }

    const request = await tx.request.findFirst({
      where: changeRequest.companyId
        ? { id: changeRequest.entityId, companyId: changeRequest.companyId }
        : { id: changeRequest.entityId, client: { userId: changeRequest.requestedById } },
      select: { id: true, description: true, equipmentType: true, model: true, vinOrSerial: true }
    });

    if (!request) {
      return { ok: false, status: 'change-request-target-not-found-or-forbidden' };
    }

    await tx.request.update({ where: { id: request.id }, data });
    const newValue = extractNewValue(changeRequest, field);

    return {
      ok: true,
      audit: {
        entityType: 'REQUEST',
        entityId: request.id,
        action: 'CHANGE_APPLIED',
        oldValue: { [field]: request[field] ?? null },
        newValue: { [field]: newValue as Prisma.InputJsonValue },
        metadata: {
          fieldName: changeRequest.fieldName,
          normalizedField: field,
          action: changeRequest.action,
          source: 'CHANGE_REQUEST_APPROVAL'
        }
      }
    };
  }

  if (changeRequest.entityType === 'REQUEST_ITEM' && changeRequest.action === 'UPDATE') {
    const field = normalizeRequestItemField(changeRequest.fieldName);

    if (!field) {
      return { ok: false, status: 'change-request-field-not-allowed' };
    }

    const data = requestItemUpdateData(field, extractNewValue(changeRequest, field));

    if (!data) {
      return { ok: false, status: changeRequest.newValue == null ? 'change-request-new-value-required' : 'change-request-invalid-value' };
    }

    const requestItem = await tx.requestItem.findFirst({
      where: changeRequest.companyId
        ? { id: changeRequest.entityId, visibleToClient: true, request: { companyId: changeRequest.companyId } }
        : { id: changeRequest.entityId, visibleToClient: true, request: { client: { userId: changeRequest.requestedById } } },
      select: { id: true, name: true, brand: true, catalogNumber: true, analogNumber: true, quantity: true, unit: true, comment: true }
    });

    if (!requestItem) {
      return { ok: false, status: 'change-request-target-not-found-or-forbidden' };
    }

    await tx.requestItem.update({ where: { id: requestItem.id }, data });
    const newValue = extractNewValue(changeRequest, field);

    return {
      ok: true,
      audit: {
        entityType: 'REQUEST_ITEM',
        entityId: requestItem.id,
        action: 'CHANGE_APPLIED',
        oldValue: { [field]: requestItem[field] ?? null },
        newValue: { [field]: newValue as Prisma.InputJsonValue },
        metadata: {
          fieldName: changeRequest.fieldName,
          normalizedField: field,
          action: changeRequest.action,
          source: 'CHANGE_REQUEST_APPROVAL'
        }
      }
    };
  }

  if (changeRequest.entityType === 'VEHICLE' && changeRequest.action === 'UPDATE') {
    const field = normalizeVehicleField(changeRequest.fieldName);

    if (!field) {
      return { ok: false, status: 'change-request-field-not-allowed' };
    }

    const data = vehicleUpdateData(field, extractNewValue(changeRequest, field));

    if (!data) {
      return { ok: false, status: changeRequest.newValue == null ? 'change-request-new-value-required' : 'change-request-invalid-value' };
    }

    const vehicle = await tx.vehicle.findFirst({
      where: changeRequest.companyId
        ? { id: changeRequest.entityId, companyId: changeRequest.companyId }
        : { id: changeRequest.entityId, client: { userId: changeRequest.requestedById } },
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

    if (!vehicle || !isValidVehicleOwnership(vehicle)) {
      return { ok: false, status: 'change-request-target-not-found-or-forbidden' };
    }

    if (!isEditableVehicleField(field)) {
      return { ok: false, status: 'change-request-field-not-allowed' };
    }

    const currentValue = pickEditableVehicleFields(vehicle)[field];
    const storedOldValue = normalizeEditableVehicleValue(field, readChangeValue(changeRequest.oldValue, field));
    if (storedOldValue === undefined || currentValue !== storedOldValue) {
      return { ok: false, status: 'change-request-stale-conflict' };
    }

    const requestedValue = extractNewValue(changeRequest, field);
    let canonicalNewValue = normalizeEditableVehicleValue(field, requestedValue);
    if (canonicalNewValue === undefined || canonicalNewValue === currentValue) {
      return { ok: false, status: 'change-request-invalid-value' };
    }

    if (
      (field === 'type' || field === 'manufacturer') &&
      typeof canonicalNewValue === 'string' &&
      canonicalNewValue.length > EQUIPMENT_TEXT_FIELD_MAX_LENGTH
    ) {
      return { ok: false, status: 'change-request-invalid-value' };
    }

    if (EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && field === 'type' && typeof canonicalNewValue === 'string') {
      const equipmentType = await tx.equipmentType.findFirst({
        where: {
          normalizedName: normalizeTaxonomyName(canonicalNewValue),
          isActive: true,
          manufacturers: {
            some: { manufacturer: { name: { equals: vehicle.manufacturer, mode: 'insensitive' }, isActive: true } }
          }
        },
        select: { name: true }
      });
      if (!equipmentType) return { ok: false, status: 'change-request-invalid-value' };
      canonicalNewValue = equipmentType.name;
    }

    if (EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED && field === 'manufacturer' && typeof canonicalNewValue === 'string') {
      const manufacturer = await tx.manufacturer.findFirst({
        where: {
          name: { equals: canonicalNewValue, mode: 'insensitive' },
          isActive: true,
          equipmentTypes: {
            some: { equipmentType: { normalizedName: normalizeTaxonomyName(vehicle.type), isActive: true } }
          }
        },
        select: { name: true }
      });
      if (!manufacturer) return { ok: false, status: 'change-request-invalid-value' };
      canonicalNewValue = manufacturer.name;
    }

    if (field === 'vinOrSerial') {
      const duplicate = await findVehicleVinDuplicate({
        db: tx,
        owner: vehicle,
        normalizedVin: typeof canonicalNewValue === 'string' ? canonicalNewValue : null,
        excludeVehicleId: vehicle.id
      });

      if (duplicate) {
        return { ok: false, status: 'change-request-vehicle-vin-duplicate' };
      }
    }

    await tx.vehicle.update({ where: { id: vehicle.id }, data: { ...data, [field]: canonicalNewValue } });

    return {
      ok: true,
      audit: {
        entityType: 'VEHICLE',
        entityId: vehicle.id,
        action: 'CHANGE_APPLIED',
        oldValue: { [field]: currentValue },
        newValue: { [field]: canonicalNewValue },
        metadata: {
          fieldName: changeRequest.fieldName,
          normalizedField: field,
          action: changeRequest.action,
          source: 'CHANGE_REQUEST_APPROVAL'
        }
      }
    };
  }

  if (changeRequest.entityType === 'VEHICLE' && changeRequest.action === 'ARCHIVE') {
    const vehicle = await tx.vehicle.findFirst({
      where: changeRequest.companyId
        ? { id: changeRequest.entityId, companyId: changeRequest.companyId }
        : { id: changeRequest.entityId, client: { userId: changeRequest.requestedById } },
      select: { id: true, archivedAt: true, archivedById: true }
    });

    if (!vehicle) {
      return { ok: false, status: 'change-request-target-not-found-or-forbidden' };
    }

    const archivedAt = new Date();

    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: {
        archivedAt,
        archivedBy: { connect: { id: reviewedById } }
      }
    });

    return {
      ok: true,
      audit: {
        entityType: 'VEHICLE',
        entityId: vehicle.id,
        action: 'VEHICLE_ARCHIVED',
        oldValue: {
          archivedAt: vehicle.archivedAt?.toISOString() ?? null,
          archivedById: vehicle.archivedById
        },
        newValue: {
          archivedAt: archivedAt.toISOString(),
          archivedById: reviewedById
        },
        metadata: {
          action: changeRequest.action,
          source: 'CHANGE_REQUEST_APPROVAL'
        }
      }
    };
  }

  return { ok: false, status: 'change-request-unsupported-apply' };
}
