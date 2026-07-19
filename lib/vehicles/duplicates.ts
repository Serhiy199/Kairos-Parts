import 'server-only';

import type { Prisma } from '@prisma/client';

import type { VehicleOwnership } from '@/lib/vehicles/ownership';
import { normalizeVehicleVin } from '@/lib/vehicles/vin';

export const VEHICLE_VIN_DUPLICATE_MESSAGE =
  'Техніка з таким VIN або серійним номером уже є в парку цього власника.';

type VehicleDuplicateDatabase = Pick<Prisma.TransactionClient, 'vehicle'>;

type FindVehicleVinDuplicateInput = {
  db: VehicleDuplicateDatabase;
  owner: VehicleOwnership;
  normalizedVin: string | null;
  excludeVehicleId?: string;
};

export type VehicleVinDuplicate = {
  id: string;
  type: string;
  manufacturer: string;
  model: string;
  year: number | null;
  vinOrSerial: string | null;
};

export async function findVehicleVinDuplicate({
  db,
  owner,
  normalizedVin,
  excludeVehicleId
}: FindVehicleVinDuplicateInput): Promise<VehicleVinDuplicate | null> {
  if (!normalizedVin) {
    return null;
  }

  const candidates = await db.vehicle.findMany({
    where: {
      ...owner,
      vinOrSerial: { not: null },
      ...(excludeVehicleId ? { id: { not: excludeVehicleId } } : {})
    },
    select: {
      id: true,
      type: true,
      manufacturer: true,
      model: true,
      year: true,
      vinOrSerial: true
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  return candidates.find((vehicle) => normalizeVehicleVin(vehicle.vinOrSerial) === normalizedVin) ?? null;
}
