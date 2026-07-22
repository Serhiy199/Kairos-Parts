import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const adminVehicleSummarySelect = {
  id: true,
  name: true,
  type: true,
  manufacturer: true,
  model: true,
  year: true,
  vinOrSerial: true,
  createdAt: true,
  updatedAt: true,
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 1,
    select: { id: true, secureUrl: true }
  }
} satisfies Prisma.VehicleSelect;

export type AdminVehicleSummary = Prisma.VehicleGetPayload<{
  select: typeof adminVehicleSummarySelect;
}>;

export function getAdminCompanyVehicles(companyId: string) {
  return prisma.vehicle.findMany({
    where: {
      companyId,
      clientId: null
    },
    select: adminVehicleSummarySelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });
}

export function getAdminClientVehicles(clientId: string) {
  return prisma.vehicle.findMany({
    where: {
      clientId,
      companyId: null
    },
    select: adminVehicleSummarySelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });
}
