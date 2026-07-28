import type {
  Prisma,
  RequestSelectionBatchItemStatus,
  RequestStatus
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type ClientSelectionItemReadModel = {
  id: string;
  position: number;
  status: RequestSelectionBatchItemStatus;
  equipmentType: string | null;
  itemName: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: string;
  unit: string | null;
  availability: string | null;
  deliveryTime: string | null;
  unitPrice: string | null;
  currency: string | null;
  managerComment: string | null;
  clientComment: string | null;
  vehicle: {
    displayName: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
  } | null;
};

export type ClientLegacyItemReadModel = {
  id: string;
  equipmentType: string | null;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  unit: string;
  availability: string | null;
  deliveryTime: string | null;
  salePrice: string | null;
  currency: string;
  comment: string | null;
  approvedByClient: boolean;
  includeInInvoice: boolean;
};

type ClientApprovalRequestReadModel = {
  id: string;
  number: string;
  status: RequestStatus;
};

export type ClientRequestApprovalReadModel =
  | {
      request: ClientApprovalRequestReadModel;
      mode: 'BATCH';
      activeBatch: {
        id: string;
        revision: number;
        status: 'SENT' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
        sentAt: string | null;
        itemCount: number;
        items: ClientSelectionItemReadModel[];
      };
      legacyItems: [];
    }
  | {
      request: ClientApprovalRequestReadModel;
      mode: 'LEGACY';
      activeBatch: null;
      legacyItems: ClientLegacyItemReadModel[];
    }
  | {
      request: ClientApprovalRequestReadModel;
      mode: 'EMPTY';
      activeBatch: null;
      legacyItems: [];
    };

export type ClientRequestApprovalReadErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ACTOR_NOT_FOUND'
  | 'ACTOR_NOT_ALLOWED'
  | 'REQUEST_ACCESS_DENIED'
  | 'ACTIVE_BATCH_INTEGRITY_ERROR'
  | 'BATCH_READ_FAILED'
  | 'LEGACY_READ_FAILED';

export class ClientRequestApprovalReadError extends Error {
  constructor(
    readonly code: ClientRequestApprovalReadErrorCode,
    readonly context: { requestId: string },
    options?: ErrorOptions
  ) {
    super(`Client request approval read failed: ${code}.`, options);
    this.name = 'ClientRequestApprovalReadError';
  }
}

const actorSelect = {
  id: true,
  role: true,
  status: true,
  clientProfile: { select: { id: true } },
  companyMemberships: {
    take: 1,
    orderBy: { createdAt: 'asc' },
    select: { companyId: true }
  }
} satisfies Prisma.UserSelect;

const requestSelect = {
  id: true,
  requestNumber: true,
  status: true,
  clientId: true,
  companyId: true
} satisfies Prisma.RequestSelect;

const batchItemSelect = {
  id: true,
  position: true,
  status: true,
  equipmentType: true,
  itemName: true,
  brand: true,
  catalogNumber: true,
  analogNumber: true,
  quantity: true,
  unit: true,
  availability: true,
  deliveryTime: true,
  approvedUnitPrice: true,
  currency: true,
  managerComment: true,
  clientComment: true,
  vehicleDisplayName: true,
  vehicleBrand: true,
  vehicleModel: true,
  vehicleYear: true
} satisfies Prisma.RequestSelectionBatchItemSelect;

const activeBatchSelect = {
  id: true,
  revision: true,
  status: true,
  sentAt: true,
  items: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: batchItemSelect
  }
} satisfies Prisma.RequestSelectionBatchSelect;

const legacyItemSelect = {
  id: true,
  equipmentType: true,
  name: true,
  brand: true,
  catalogNumber: true,
  analogNumber: true,
  quantity: true,
  unit: true,
  availability: true,
  deliveryTime: true,
  salePrice: true,
  currency: true,
  comment: true,
  approvedByClient: true,
  includeInInvoice: true
} satisfies Prisma.RequestItemSelect;

type ActorRecord = Prisma.UserGetPayload<{ select: typeof actorSelect }>;
type RequestRecord = Prisma.RequestGetPayload<{ select: typeof requestSelect }>;
type BatchItemRecord = Prisma.RequestSelectionBatchItemGetPayload<{
  select: typeof batchItemSelect;
}>;
type ActiveBatchRecord = Prisma.RequestSelectionBatchGetPayload<{
  select: typeof activeBatchSelect;
}>;
type LegacyItemRecord = Prisma.RequestItemGetPayload<{ select: typeof legacyItemSelect }>;

type ReadDatabase = Pick<
  typeof prisma,
  'user' | 'request' | 'requestSelectionBatch' | 'requestItem'
>;

function readError(
  code: ClientRequestApprovalReadErrorCode,
  requestId: string,
  cause?: unknown
): ClientRequestApprovalReadError {
  return new ClientRequestApprovalReadError(
    code,
    { requestId },
    cause === undefined ? undefined : { cause }
  );
}

function actorAccess(actor: ActorRecord, request: RequestRecord) {
  const clientProfileId = actor.clientProfile?.id;
  if (!clientProfileId) return false;
  const companyId = actor.companyMemberships[0]?.companyId ?? null;

  if (request.companyId) {
    return companyId === request.companyId;
  }
  return request.clientId === clientProfileId;
}

function hasVehicleSnapshot(item: BatchItemRecord) {
  return Boolean(
    item.vehicleDisplayName
    || item.vehicleBrand
    || item.vehicleModel
    || item.vehicleYear
  );
}

export function mapClientSelectionItem(
  item: BatchItemRecord
): ClientSelectionItemReadModel {
  return {
    id: item.id,
    position: item.position,
    status: item.status,
    equipmentType: item.equipmentType,
    itemName: item.itemName,
    brand: item.brand,
    catalogNumber: item.catalogNumber,
    analogNumber: item.analogNumber,
    quantity: String(item.quantity),
    unit: item.unit.trim() || null,
    availability: item.availability,
    deliveryTime: item.deliveryTime,
    unitPrice: item.approvedUnitPrice?.toString() ?? null,
    currency: item.approvedUnitPrice === null ? null : item.currency,
    managerComment: item.managerComment,
    clientComment: item.clientComment,
    vehicle: hasVehicleSnapshot(item)
      ? {
          displayName: item.vehicleDisplayName,
          brand: item.vehicleBrand,
          model: item.vehicleModel,
          year: item.vehicleYear
        }
      : null
  };
}

export function mapClientLegacyItem(item: LegacyItemRecord): ClientLegacyItemReadModel {
  return {
    id: item.id,
    equipmentType: item.equipmentType,
    name: item.name,
    brand: item.brand,
    catalogNumber: item.catalogNumber,
    analogNumber: item.analogNumber,
    quantity: item.quantity,
    unit: item.unit,
    availability: item.availability,
    deliveryTime: item.deliveryTime,
    salePrice: item.salePrice?.toString() ?? null,
    currency: item.currency,
    comment: item.comment,
    approvedByClient: item.approvedByClient,
    includeInInvoice: item.includeInInvoice
  };
}

function requestReadModel(request: RequestRecord): ClientApprovalRequestReadModel {
  return {
    id: request.id,
    number: request.requestNumber,
    status: request.status
  };
}

function batchReadModel(
  request: RequestRecord,
  batch: ActiveBatchRecord
): ClientRequestApprovalReadModel {
  return {
    request: requestReadModel(request),
    mode: 'BATCH',
    activeBatch: {
      id: batch.id,
      revision: batch.revision,
      status: batch.status as
        | 'SENT'
        | 'APPROVED'
        | 'PARTIALLY_APPROVED'
        | 'REJECTED',
      sentAt: batch.sentAt?.toISOString() ?? null,
      itemCount: batch.items.length,
      items: batch.items.map(mapClientSelectionItem)
    },
    legacyItems: []
  };
}

export function createClientRequestApprovalReadService(database: ReadDatabase) {
  return async function getClientRequestApprovalReadModel(input: {
    requestId: string;
    actorUserId: string;
  }): Promise<ClientRequestApprovalReadModel> {
    let actor: ActorRecord | null;
    let request: RequestRecord | null;
    try {
      [actor, request] = await Promise.all([
        database.user.findUnique({
          where: { id: input.actorUserId },
          select: actorSelect
        }),
        database.request.findUnique({
          where: { id: input.requestId },
          select: requestSelect
        })
      ]);
    } catch (error) {
      throw readError('BATCH_READ_FAILED', input.requestId, error);
    }

    if (!actor) throw readError('ACTOR_NOT_FOUND', input.requestId);
    if (
      actor.role !== 'CLIENT'
      || actor.status !== 'ACTIVE'
      || !actor.clientProfile
    ) {
      throw readError('ACTOR_NOT_ALLOWED', input.requestId);
    }
    if (!request) throw readError('REQUEST_NOT_FOUND', input.requestId);
    if (!actorAccess(actor, request)) {
      throw readError('REQUEST_ACCESS_DENIED', input.requestId);
    }

    let activeBatches: ActiveBatchRecord[];
    try {
      activeBatches = await database.requestSelectionBatch.findMany({
        where: { requestId: request.id, status: 'SENT' },
        orderBy: [{ revision: 'desc' }, { id: 'asc' }],
        take: 2,
        select: activeBatchSelect
      });
    } catch (error) {
      throw readError('BATCH_READ_FAILED', request.id, error);
    }

    if (activeBatches.length > 1) {
      throw readError('ACTIVE_BATCH_INTEGRITY_ERROR', request.id);
    }
    let activeBatch = activeBatches[0];
    if (!activeBatch) {
      try {
        [activeBatch] = await database.requestSelectionBatch.findMany({
          where: {
            requestId: request.id,
            status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] }
          },
          orderBy: [{ revision: 'desc' }, { id: 'asc' }],
          take: 1,
          select: activeBatchSelect
        });
      } catch (error) {
        throw readError('BATCH_READ_FAILED', request.id, error);
      }
    }
    if (activeBatch) {
      if (activeBatch.status === 'SENT' && request.status !== 'WAITING_APPROVAL') {
        console.warn('Active request selection batch has an unexpected Request status.', {
          requestId: request.id,
          revision: activeBatch.revision,
          requestStatus: request.status
        });
      }
      return batchReadModel(request, activeBatch);
    }

    let legacyItems: LegacyItemRecord[];
    try {
      legacyItems = await database.requestItem.findMany({
        where: { requestId: request.id, visibleToClient: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: legacyItemSelect
      });
    } catch (error) {
      throw readError('LEGACY_READ_FAILED', request.id, error);
    }

    if (legacyItems.length > 0) {
      return {
        request: requestReadModel(request),
        mode: 'LEGACY',
        activeBatch: null,
        legacyItems: legacyItems.map(mapClientLegacyItem)
      };
    }

    return {
      request: requestReadModel(request),
      mode: 'EMPTY',
      activeBatch: null,
      legacyItems: []
    };
  };
}

export const getClientRequestApprovalReadModel =
  createClientRequestApprovalReadService(prisma);
