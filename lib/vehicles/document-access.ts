import type { DocumentSource, Prisma } from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';
import { vehicleAccessWhere } from '@/lib/client/access';

export type VehicleDocumentOperation =
  | 'READ'
  | 'DOWNLOAD'
  | 'UPLOAD'
  | 'DELETE'
  | 'CHANGE_VISIBILITY';

export type VehicleDocumentActor =
  | {
      userId: string;
      role: 'CLIENT';
      access: ClientAccessContext;
    }
  | {
      userId: string;
      role: 'MANAGER' | 'ADMIN';
    };

export function clientReadableVehicleDocumentWhere(
  access: ClientAccessContext
): Prisma.DocumentWhereInput {
  return {
    vehicleId: { not: null },
    vehicle: vehicleAccessWhere(access),
    OR: [
      { source: 'CLIENT' },
      { visibleToClient: true }
    ]
  };
}

export function clientDeletableVehicleDocumentWhere(
  actor: Extract<VehicleDocumentActor, { role: 'CLIENT' }>
): Prisma.DocumentWhereInput {
  return {
    ...clientReadableVehicleDocumentWhere(actor.access),
    source: 'CLIENT',
    uploadedById: actor.userId
  };
}

export function canDeleteVehicleDocument(
  actor: Pick<VehicleDocumentActor, 'userId' | 'role'>,
  document: { source: DocumentSource; uploadedById: string | null }
) {
  if (actor.role === 'ADMIN' || actor.role === 'MANAGER') return true;
  return document.source === 'CLIENT' && document.uploadedById === actor.userId;
}

export function canChangeVehicleDocumentVisibility(
  role: VehicleDocumentActor['role']
) {
  return role === 'MANAGER' || role === 'ADMIN';
}
