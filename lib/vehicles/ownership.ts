import type { Prisma } from '@prisma/client';

export type VehicleOwnerContext = {
  clientProfileId: string;
  companyId: string | null;
};

export type VehicleOwnership =
  | { clientId: string; companyId: null }
  | { clientId: null; companyId: string };

export function isValidVehicleOwnership(owner: {
  clientId: string | null;
  companyId: string | null;
}): owner is VehicleOwnership {
  return (owner.clientId !== null) !== (owner.companyId !== null);
}

export function assertValidVehicleOwnership(owner: {
  clientId: string | null;
  companyId: string | null;
}): asserts owner is VehicleOwnership {
  if (!isValidVehicleOwnership(owner)) {
    throw new Error('Vehicle must have exactly one owner.');
  }
}

export function vehicleOwnershipForClient(context: VehicleOwnerContext): VehicleOwnership {
  const owner: VehicleOwnership = context.companyId
    ? { clientId: null, companyId: context.companyId }
    : { clientId: context.clientProfileId, companyId: null };

  assertValidVehicleOwnership(owner);
  return owner;
}

export function vehicleOwnershipForCompany(companyId: string): VehicleOwnership {
  const owner: VehicleOwnership = { clientId: null, companyId };
  assertValidVehicleOwnership(owner);
  return owner;
}

export function vehicleOwnershipForPersonalClient(clientId: string): VehicleOwnership {
  const owner: VehicleOwnership = { clientId, companyId: null };
  assertValidVehicleOwnership(owner);
  return owner;
}

export function vehicleAccessWhereForClient(context: VehicleOwnerContext): Prisma.VehicleWhereInput {
  if (context.companyId) {
    return {
      OR: [
        { companyId: context.companyId, clientId: null },
        { clientId: context.clientProfileId, companyId: null }
      ]
    };
  }

  return { clientId: context.clientProfileId, companyId: null };
}
