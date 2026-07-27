import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { getVehicleDisplay } from '@/lib/vehicles/name';

export const REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION = 1;

export type RequestSelectionSnapshotSource = {
  id: string;
  updatedAt: Date;
  equipmentType: string | null;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  availability: string | null;
  deliveryTime: string | null;
  salePrice: Prisma.Decimal | null;
  currency: string;
  comment: string | null;
  vehicleId: string | null;
  vehicle: {
    id: string;
    name: string;
    manufacturer: string;
    model: string;
    year: number | null;
    vinOrSerial: string | null;
  } | null;
};

export type RequestSelectionSnapshot = {
  sourceRequestItemId: string;
  sourceUpdatedAt: Date;
  snapshotSchemaVersion: number;
  snapshotHash: string;
  equipmentType: string | null;
  itemName: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  availability: string | null;
  deliveryTime: string | null;
  approvedUnitPrice: Prisma.Decimal | null;
  currency: string;
  managerComment: string | null;
  vehicleIdSnapshot: string | null;
  vehicleDisplayName: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleVin: string | null;
};

export type RequestSelectionSnapshotErrorCode =
  | 'INVALID_ITEM_NAME'
  | 'INVALID_QUANTITY'
  | 'INVALID_UNIT'
  | 'INVALID_PRICE'
  | 'INVALID_CURRENCY'
  | 'INVALID_SOURCE_UPDATED_AT';

export class RequestSelectionSnapshotError extends Error {
  constructor(
    readonly code: RequestSelectionSnapshotErrorCode,
    readonly sourceRequestItemId: string
  ) {
    super(`Cannot build request selection snapshot for ${sourceRequestItemId}: ${code}.`);
    this.name = 'RequestSelectionSnapshotError';
  }
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, normalizeCanonicalValue(nested)])
    );
  }
  return value;
}

export function stableSerializeRequestSelectionSnapshot(value: unknown) {
  return JSON.stringify(normalizeCanonicalValue(value));
}

export function sha256RequestSelectionSnapshot(value: unknown) {
  return createHash('sha256')
    .update(stableSerializeRequestSelectionSnapshot(value), 'utf8')
    .digest('hex');
}

function canonicalSnapshotContent(
  source: RequestSelectionSnapshotSource,
  vehicleDisplayName: string | null
) {
  return {
    snapshotSchemaVersion: REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION,
    sourceRequestItemId: source.id,
    sourceUpdatedAt: source.updatedAt,
    equipmentType: source.equipmentType,
    itemName: source.name,
    brand: source.brand,
    catalogNumber: source.catalogNumber,
    analogNumber: source.analogNumber,
    quantity: source.quantity,
    unit: source.unit,
    availability: source.availability,
    deliveryTime: source.deliveryTime,
    approvedUnitPrice: source.salePrice,
    currency: source.currency,
    managerComment: source.comment,
    vehicle: source.vehicle
      ? {
          id: source.vehicle.id,
          displayName: vehicleDisplayName,
          brand: source.vehicle.manufacturer,
          model: source.vehicle.model,
          year: source.vehicle.year,
          vin: source.vehicle.vinOrSerial
        }
      : null
  };
}

function validateSource(source: RequestSelectionSnapshotSource) {
  if (!source.name.trim()) {
    throw new RequestSelectionSnapshotError('INVALID_ITEM_NAME', source.id);
  }
  if (!Number.isInteger(source.quantity) || source.quantity < 1) {
    throw new RequestSelectionSnapshotError('INVALID_QUANTITY', source.id);
  }
  if (!source.unit.trim()) {
    throw new RequestSelectionSnapshotError('INVALID_UNIT', source.id);
  }
  if (source.salePrice?.isNegative()) {
    throw new RequestSelectionSnapshotError('INVALID_PRICE', source.id);
  }
  if (!source.currency.trim()) {
    throw new RequestSelectionSnapshotError('INVALID_CURRENCY', source.id);
  }
  if (Number.isNaN(source.updatedAt.getTime())) {
    throw new RequestSelectionSnapshotError('INVALID_SOURCE_UPDATED_AT', source.id);
  }
}

export function buildRequestSelectionSnapshot(
  source: RequestSelectionSnapshotSource
): RequestSelectionSnapshot {
  validateSource(source);

  const vehicleDisplay = source.vehicle ? getVehicleDisplay(source.vehicle) : null;
  const vehicleDisplayName = vehicleDisplay
    ? [vehicleDisplay.title, vehicleDisplay.secondary].filter(Boolean).join(' · ')
    : null;
  const snapshotHash = sha256RequestSelectionSnapshot(
    canonicalSnapshotContent(source, vehicleDisplayName)
  );

  return {
    sourceRequestItemId: source.id,
    sourceUpdatedAt: source.updatedAt,
    snapshotSchemaVersion: REQUEST_SELECTION_SNAPSHOT_SCHEMA_VERSION,
    snapshotHash,
    equipmentType: source.equipmentType,
    itemName: source.name,
    brand: source.brand,
    catalogNumber: source.catalogNumber,
    analogNumber: source.analogNumber,
    quantity: source.quantity,
    unit: source.unit,
    availability: source.availability,
    deliveryTime: source.deliveryTime,
    approvedUnitPrice: source.salePrice,
    currency: source.currency,
    managerComment: source.comment,
    vehicleIdSnapshot: source.vehicleId,
    vehicleDisplayName,
    vehicleBrand: source.vehicle?.manufacturer ?? null,
    vehicleModel: source.vehicle?.model ?? null,
    vehicleYear: source.vehicle?.year ?? null,
    vehicleVin: source.vehicle?.vinOrSerial ?? null
  };
}

export function hashRequestSelectionBatchSnapshots(
  snapshots: ReadonlyArray<{ position: number; snapshotHash: string }>
) {
  return sha256RequestSelectionSnapshot(
    snapshots.map(({ position, snapshotHash }) => ({ position, snapshotHash }))
  );
}
