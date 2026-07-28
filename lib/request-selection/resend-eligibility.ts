import type { Prisma, RequestStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  buildRequestSelectionSnapshot,
  hashRequestSelectionApprovalContent,
  type RequestSelectionApprovalContent,
  type RequestSelectionSnapshotSource
} from '@/lib/request-selection/snapshot';

const sendableRequestStatuses = new Set<RequestStatus>([
  'IN_PROGRESS',
  'OFFER_PREPARING',
  'WAITING_APPROVAL'
]);

const currentItemSelect = {
  id: true,
  requestId: true,
  createdAt: true,
  updatedAt: true,
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
  vehicleId: true,
  vehicle: {
    select: {
      id: true,
      name: true,
      manufacturer: true,
      model: true,
      year: true,
      vinOrSerial: true
    }
  }
} satisfies Prisma.RequestItemSelect;

const activeBatchItemSelect = {
  id: true,
  sourceRequestItemId: true,
  sourceUpdatedAt: true,
  snapshotSchemaVersion: true,
  snapshotHash: true,
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
  vehicleIdSnapshot: true,
  vehicleDisplayName: true,
  vehicleBrand: true,
  vehicleModel: true,
  vehicleYear: true,
  vehicleVin: true
} satisfies Prisma.RequestSelectionBatchItemSelect;

type CurrentItem = Prisma.RequestItemGetPayload<{ select: typeof currentItemSelect }>;
type ActiveBatchItem = Prisma.RequestSelectionBatchItemGetPayload<{
  select: typeof activeBatchItemSelect;
}>;

export const REQUEST_SELECTION_RESEND_ITEM_STATES = {
  NOT_SENT: 'NOT_SENT',
  UNCHANGED: 'UNCHANGED',
  CHANGED_AFTER_SEND: 'CHANGED_AFTER_SEND',
  NEW_AFTER_SEND: 'NEW_AFTER_SEND'
} as const;

export type RequestSelectionResendItemState =
  (typeof REQUEST_SELECTION_RESEND_ITEM_STATES)[keyof typeof REQUEST_SELECTION_RESEND_ITEM_STATES];

export type RequestSelectionResendEligibilityReason =
  | 'HAS_NOT_SENT_ITEMS'
  | 'HAS_NEW_ITEMS'
  | 'HAS_CHANGED_ITEMS'
  | 'HAS_REMOVED_ITEMS'
  | 'HAS_MULTIPLE_CHANGES'
  | 'NOTHING_TO_SEND'
  | 'REQUEST_STATUS_BLOCKED';

export type RequestSelectionResendEligibility = {
  requestId: string;
  requestStatus: RequestStatus;
  activeBatchId: string | null;
  activeRevision: number | null;
  items: Array<{
    requestItemId: string;
    activeBatchItemId: string | null;
    state: RequestSelectionResendItemState;
    currentUpdatedAt: string;
    activeBatchSourceUpdatedAt: string | null;
    currentApprovalHash: string;
    activeApprovalHash: string | null;
  }>;
  eligibleItemIds: string[];
  notSentItemIds: string[];
  changedItemIds: string[];
  newItemIds: string[];
  unchangedItemIds: string[];
  removedBatchItemIds: string[];
  canSend: boolean;
  reason: RequestSelectionResendEligibilityReason;
};

export class RequestSelectionResendEligibilityError extends Error {
  constructor(
    readonly code:
      | 'REQUEST_NOT_FOUND'
      | 'ACTIVE_BATCH_INTEGRITY_ERROR'
      | 'SNAPSHOT_BUILD_FAILED',
    readonly requestId: string,
    options?: ErrorOptions
  ) {
    super(`Request selection resend eligibility failed: ${code}.`, options);
    this.name = 'RequestSelectionResendEligibilityError';
  }
}

type ActiveBatch = {
  id: string;
  revision: number;
  items: ActiveBatchItem[];
};

type EligibilitySource = {
  id: string;
  status: RequestStatus;
  items: CurrentItem[];
};

function activeApprovalContent(item: ActiveBatchItem): RequestSelectionApprovalContent {
  return {
    snapshotSchemaVersion: item.snapshotSchemaVersion,
    equipmentType: item.equipmentType,
    itemName: item.itemName,
    brand: item.brand,
    catalogNumber: item.catalogNumber,
    analogNumber: item.analogNumber,
    quantity: item.quantity,
    unit: item.unit,
    availability: item.availability,
    deliveryTime: item.deliveryTime,
    approvedUnitPrice: item.approvedUnitPrice,
    currency: item.currency,
    managerComment: item.managerComment,
    vehicleIdSnapshot: item.vehicleIdSnapshot,
    vehicleDisplayName: item.vehicleDisplayName,
    vehicleBrand: item.vehicleBrand,
    vehicleModel: item.vehicleModel,
    vehicleYear: item.vehicleYear,
    vehicleVin: item.vehicleVin
  };
}

export function deriveRequestSelectionResendEligibility(input: {
  request: EligibilitySource;
  activeBatch: ActiveBatch | null;
}): RequestSelectionResendEligibility {
  const activeBySourceId = new Map(
    (input.activeBatch?.items ?? [])
      .filter((item): item is ActiveBatchItem & { sourceRequestItemId: string } =>
        Boolean(item.sourceRequestItemId)
      )
      .map((item) => [item.sourceRequestItemId, item])
  );
  const currentIds = new Set(input.request.items.map((item) => item.id));
  const notSentItemIds: string[] = [];
  const changedItemIds: string[] = [];
  const newItemIds: string[] = [];
  const unchangedItemIds: string[] = [];

  const items = input.request.items.map((item) => {
    let currentSnapshot;
    try {
      currentSnapshot = buildRequestSelectionSnapshot(item as RequestSelectionSnapshotSource);
    } catch (error) {
      throw new RequestSelectionResendEligibilityError(
        'SNAPSHOT_BUILD_FAILED',
        input.request.id,
        { cause: error }
      );
    }
    const currentApprovalHash = hashRequestSelectionApprovalContent(currentSnapshot);
    const activeItem = activeBySourceId.get(item.id) ?? null;
    const activeApprovalHash = activeItem
      ? hashRequestSelectionApprovalContent(activeApprovalContent(activeItem))
      : null;

    let state: RequestSelectionResendItemState;
    if (!input.activeBatch) {
      state = 'NOT_SENT';
      notSentItemIds.push(item.id);
    } else if (!activeItem) {
      state = 'NEW_AFTER_SEND';
      newItemIds.push(item.id);
    } else if (currentApprovalHash === activeApprovalHash) {
      state = 'UNCHANGED';
      unchangedItemIds.push(item.id);
    } else {
      state = 'CHANGED_AFTER_SEND';
      changedItemIds.push(item.id);
    }

    return {
      requestItemId: item.id,
      activeBatchItemId: activeItem?.id ?? null,
      state,
      currentUpdatedAt: item.updatedAt.toISOString(),
      activeBatchSourceUpdatedAt: activeItem?.sourceUpdatedAt.toISOString() ?? null,
      currentApprovalHash,
      activeApprovalHash
    };
  });

  const removedBatchItemIds = (input.activeBatch?.items ?? [])
    .filter((item) =>
      item.sourceRequestItemId === null || !currentIds.has(item.sourceRequestItemId)
    )
    .map((item) => item.id);
  const requestStatusAllowed = sendableRequestStatuses.has(input.request.status);
  const hasCurrentItems = input.request.items.length > 0;
  const dirtyKinds = [
    notSentItemIds.length > 0,
    newItemIds.length > 0,
    changedItemIds.length > 0,
    removedBatchItemIds.length > 0
  ].filter(Boolean).length;
  const hasDirtySelection = dirtyKinds > 0;
  const canSend = requestStatusAllowed && hasCurrentItems && hasDirtySelection;

  let reason: RequestSelectionResendEligibilityReason;
  if (!requestStatusAllowed) reason = 'REQUEST_STATUS_BLOCKED';
  else if (!hasCurrentItems || !hasDirtySelection) reason = 'NOTHING_TO_SEND';
  else if (dirtyKinds > 1) reason = 'HAS_MULTIPLE_CHANGES';
  else if (notSentItemIds.length > 0) reason = 'HAS_NOT_SENT_ITEMS';
  else if (newItemIds.length > 0) reason = 'HAS_NEW_ITEMS';
  else if (changedItemIds.length > 0) reason = 'HAS_CHANGED_ITEMS';
  else reason = 'HAS_REMOVED_ITEMS';

  return {
    requestId: input.request.id,
    requestStatus: input.request.status,
    activeBatchId: input.activeBatch?.id ?? null,
    activeRevision: input.activeBatch?.revision ?? null,
    items,
    eligibleItemIds: canSend ? input.request.items.map((item) => item.id) : [],
    notSentItemIds,
    changedItemIds,
    newItemIds,
    unchangedItemIds,
    removedBatchItemIds,
    canSend,
    reason
  };
}

type EligibilityDatabase = Pick<
  Prisma.TransactionClient,
  'request' | 'requestSelectionBatch'
>;

export function createRequestSelectionResendEligibilityService(
  database: EligibilityDatabase
) {
  return async function getRequestSelectionResendEligibility(input: {
    requestId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RequestSelectionResendEligibility> {
    const db = input.tx ?? database;
    const [request, activeBatches] = await Promise.all([
      db.request.findUnique({
        where: { id: input.requestId },
        select: {
          id: true,
          status: true,
          items: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: currentItemSelect
          }
        }
      }),
      db.requestSelectionBatch.findMany({
        where: { requestId: input.requestId, status: 'SENT' },
        orderBy: [{ revision: 'desc' }, { id: 'asc' }],
        take: 2,
        select: {
          id: true,
          revision: true,
          items: {
            orderBy: { position: 'asc' },
            select: activeBatchItemSelect
          }
        }
      })
    ]);

    if (!request) {
      throw new RequestSelectionResendEligibilityError(
        'REQUEST_NOT_FOUND',
        input.requestId
      );
    }
    if (activeBatches.length > 1) {
      throw new RequestSelectionResendEligibilityError(
        'ACTIVE_BATCH_INTEGRITY_ERROR',
        input.requestId
      );
    }

    return deriveRequestSelectionResendEligibility({
      request,
      activeBatch: activeBatches[0] ?? null
    });
  };
}

export const getRequestSelectionResendEligibility =
  createRequestSelectionResendEligibilityService(prisma);
