import 'server-only';

import type { ClientAccessContext } from '@/lib/client/access';
import { vehicleAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

const vehicleImageOrder = [
  { isPrimary: 'desc' as const },
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const }
];

export async function getClientVehicleOverview(access: ClientAccessContext) {
  const vehicles = await prisma.vehicle.findMany({
    where: vehicleAccessWhere(access),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      clientId: true,
      companyId: true,
      type: true,
      manufacturer: true,
      model: true,
      year: true,
      vinOrSerial: true,
      archivedAt: true,
      company: { select: { name: true } },
      _count: { select: { requests: true } },
      images: {
        orderBy: vehicleImageOrder,
        take: 1,
        select: { secureUrl: true }
      }
    }
  });

  return {
    personalVehicles: vehicles.filter(
      (vehicle) => vehicle.clientId === access.clientProfileId && vehicle.companyId === null
    ),
    companyVehicles: access.companyId
      ? vehicles.filter(
          (vehicle) => vehicle.companyId === access.companyId && vehicle.clientId === null
        )
      : [],
    companyName: access.companyName
  };
}

export async function getClientVehicleDetail(vehicleId: string, access: ClientAccessContext) {
  return prisma.vehicle.findFirst({
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
      comment: true,
      archivedAt: true,
      company: { select: { name: true } },
      requests: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          createdAt: true,
          description: true
        }
      },
      requestItems: {
        where: { visibleToClient: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          name: true,
          brand: true,
          catalogNumber: true,
          quantity: true,
          unit: true,
          availability: true,
          comment: true,
          request: {
            select: {
              id: true,
              requestNumber: true,
              status: true,
              createdAt: true
            }
          }
        }
      },
      images: {
        orderBy: vehicleImageOrder,
        select: { id: true, secureUrl: true, isPrimary: true }
      },
      documents: {
        where: {
          visibleToClient: true,
          clientId: null,
          companyId: null,
          requestId: null
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          size: true,
          createdAt: true
        }
      }
    }
  });
}
