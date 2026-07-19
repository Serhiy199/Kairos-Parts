import type { Prisma, Vehicle } from '@prisma/client';

import { normalizeVehicleVin } from '@/lib/vehicles/vin';

export const EDITABLE_VEHICLE_FIELDS = [
  'type',
  'manufacturer',
  'model',
  'year',
  'vinOrSerial',
  'comment'
] as const;

export type EditableVehicleField = (typeof EDITABLE_VEHICLE_FIELDS)[number];
export type VehicleChangeSnapshot = Record<EditableVehicleField, string | number | null>;

type VehicleSource = Pick<Vehicle, EditableVehicleField>;

export function isEditableVehicleField(value: string | null): value is EditableVehicleField {
  return value !== null && EDITABLE_VEHICLE_FIELDS.includes(value as EditableVehicleField);
}

export function pickEditableVehicleFields(vehicle: VehicleSource): VehicleChangeSnapshot {
  return {
    type: vehicle.type.trim(),
    manufacturer: vehicle.manufacturer.trim(),
    model: vehicle.model.trim(),
    year: vehicle.year,
    vinOrSerial: normalizeVehicleVin(vehicle.vinOrSerial ?? ''),
    comment: vehicle.comment?.trim() || null
  };
}

export function normalizeEditableVehicleValue(
  field: EditableVehicleField,
  value: unknown
): string | number | null | undefined {
  if (field === 'year') {
    if (value === null || value === '') return null;
    const year = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isInteger(year) && year >= 1950 && year <= 2100 ? year : undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && value !== null) return undefined;
  const text = value === null ? '' : String(value).trim();

  if (field === 'vinOrSerial') {
    return text.length <= 120 ? normalizeVehicleVin(text) : undefined;
  }

  if (field === 'comment') {
    return text.length <= 1000 ? text || null : undefined;
  }

  return text && text.length <= 500 ? text : undefined;
}

export function diffVehicleFields(before: VehicleChangeSnapshot, after: VehicleChangeSnapshot) {
  const oldValue: Partial<VehicleChangeSnapshot> = {};
  const newValue: Partial<VehicleChangeSnapshot> = {};

  for (const field of EDITABLE_VEHICLE_FIELDS) {
    if (before[field] !== after[field]) {
      oldValue[field] = before[field];
      newValue[field] = after[field];
    }
  }

  return {
    changedFields: Object.keys(newValue) as EditableVehicleField[],
    oldValue: oldValue as Prisma.InputJsonObject,
    newValue: newValue as Prisma.InputJsonObject
  };
}

export function readChangeValue(value: Prisma.JsonValue | null, field: EditableVehicleField) {
  if (value && typeof value === 'object' && !Array.isArray(value) && field in value) {
    return value[field];
  }
  return value;
}
