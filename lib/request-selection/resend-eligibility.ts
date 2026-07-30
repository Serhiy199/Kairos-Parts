import type {
  InvoiceStatus,
  Prisma,
  RequestStatus
} from '@prisma/client';

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
  status: true,
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
type ComparableBatchItem = Omit<ActiveBatchItem, 'status'> & {
  status?: ActiveBatchItem['status'];
};

export const REQUEST_SELECTION_RESEND_ITEM_STATES = {
  NOT_SENT: 'NOT_SENT',
  UNCHANGED: 'UNCHANGED',
  CHANGED_AFTER_SEND: 'CHANGED_AFTER_SEND',
  NEW_AFTER_SEND: 'NEW_AFTER_SEND',
  LOCKED_APPROVED: 'LOCKED_APPROVED',
  UNCHANGED_REJECTED: 'UNCHANGED_REJECTED',
  CHANGED_REJECTED: 'CHANGED_REJECTED',
  NEW_FOLLOW_UP: 'NEW_FOLLOW_UP'
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
  | 'REQUEST_STATUS_BLOCKED'
  | 'HAS_REJECTED_CHANGES'
  | 'HAS_NEW_REPLACEMENT_ITEMS'
  | 'HAS_REJECTED_AND_NEW_ITEMS'
  | 'NO_FOLLOW_UP_CHANGES'
  | 'ACTIVE_SENT_BATCH_EXISTS'
  | 'INVOICE_DRAFT_EXISTS'
  | 'INVOICE_ALREADY_SENT'
  | 'NO_FINALIZED_SELECTION';

export type RequestSelectionResendEligibility = {
  requestId: string;
  requestStatus: RequestStatus;
  activeBatchId: string | null;
  activeRevision: number | null;
  items: Array<{
    requestItemId: string;
    activeBatchItemId: string | null;
    approvedBatchItemId: string | null;
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
  hasUnpublishedSelectionChanges: boolean;
  finalizedSelectionLocked: boolean;
  mode?: 'INITIAL' | 'RESEND_ACTIVE' | 'FOLLOW_UP_REJECTED';
  sourceBatch?: {
    id: string;
    revision: number;
    status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  } | null;
  currentInvoice?: { id: string; status: InvoiceStatus } | null;
  approvedLockedItemIds?: string[];
  rejectedEditableItemIds?: string[];
  changedRejectedItemIds?: string[];
  removedRejectedSourceIds?: string[];
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
  items: ComparableBatchItem[];
};

type FinalizedBatch = Omit<ActiveBatch, 'items'> & {
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  items: ActiveBatchItem[];
};

type EligibilitySource = {
  id: string;
  status: RequestStatus;
  items: CurrentItem[];
};

function activeApprovalContent(item: ComparableBatchItem): RequestSelectionApprovalContent {
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
      .filter((item): item is ComparableBatchItem & { sourceRequestItemId: string } =>
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
      approvedBatchItemId: null,
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
    hasUnpublishedSelectionChanges: hasDirtySelection && Boolean(input.activeBatch),
    finalizedSelectionLocked: false,
    canSend,
    reason
  };
}

export function deriveRequestSelectionFollowUpEligibility(input: {
  request: EligibilitySource;
  activeBatch: ActiveBatch | null;
  sourceBatch: FinalizedBatch | null;
  finalizedBatches?: FinalizedBatch[];
  currentInvoice: { id: string; status: InvoiceStatus } | null;
}): RequestSelectionResendEligibility {
  const finalizedBatches = input.finalizedBatches
    ?? (input.sourceBatch ? [input.sourceBatch] : []);
  const sourceItems = finalizedBatches.flatMap((batch) => batch.items);
  const approvedSourceIds = new Set(
    sourceItems
      .filter(
        (item): item is ActiveBatchItem & { sourceRequestItemId: string } =>
          item.status === 'APPROVED' && Boolean(item.sourceRequestItemId)
      )
      .map((item) => item.sourceRequestItemId)
  );
  const approvedBySourceId = new Map<string, ActiveBatchItem>();
  for (const item of sourceItems) {
    if (
      item.status === 'APPROVED'
      && item.sourceRequestItemId
      && !approvedBySourceId.has(item.sourceRequestItemId)
    ) {
      approvedBySourceId.set(item.sourceRequestItemId, item);
    }
  }
  const sourceByRequestItemId = new Map<string, ActiveBatchItem>();
  for (const item of sourceItems) {
    if (
      item.sourceRequestItemId
      && !sourceByRequestItemId.has(item.sourceRequestItemId)
    ) {
      sourceByRequestItemId.set(item.sourceRequestItemId, item);
    }
  }
  const currentIds = new Set(input.request.items.map((item) => item.id));
  const approvedLockedItemIds: string[] = [];
  const rejectedEditableItemIds: string[] = [];
  const changedRejectedItemIds: string[] = [];
  const newItemIds: string[] = [];
  const unchangedItemIds: string[] = [];

  const items = input.request.items.map((item) => {
    const currentSnapshot = buildRequestSelectionSnapshot(
      item as RequestSelectionSnapshotSource
    );
    const currentApprovalHash = hashRequestSelectionApprovalContent(currentSnapshot);
    const sourceItem = sourceByRequestItemId.get(item.id) ?? null;
    const sourceApprovalHash = sourceItem
      ? hashRequestSelectionApprovalContent(activeApprovalContent(sourceItem))
      : null;
    let state: RequestSelectionResendItemState;

    if (approvedSourceIds.has(item.id)) {
      state = 'LOCKED_APPROVED';
      approvedLockedItemIds.push(item.id);
    } else if (sourceItem?.status === 'REJECTED') {
      rejectedEditableItemIds.push(item.id);
      if (sourceApprovalHash === currentApprovalHash) {
        state = 'UNCHANGED_REJECTED';
        unchangedItemIds.push(item.id);
      } else {
        state = 'CHANGED_REJECTED';
        changedRejectedItemIds.push(item.id);
      }
    } else {
      state = 'NEW_FOLLOW_UP';
      newItemIds.push(item.id);
    }

    return {
      requestItemId: item.id,
      activeBatchItemId: sourceItem?.id ?? null,
      approvedBatchItemId: approvedBySourceId.get(item.id)?.id ?? null,
      state,
      currentUpdatedAt: item.updatedAt.toISOString(),
      activeBatchSourceUpdatedAt: sourceItem?.sourceUpdatedAt.toISOString() ?? null,
      currentApprovalHash,
      activeApprovalHash: sourceApprovalHash
    };
  });
  const removedRejectedSourceIds = sourceItems
    .filter(
      (item) =>
        item.status === 'REJECTED'
        && (
          item.sourceRequestItemId === null
          || !currentIds.has(item.sourceRequestItemId)
        )
    )
    .map((item) => item.sourceRequestItemId ?? item.id);
  const followUpCandidateItemIds = [
    ...changedRejectedItemIds,
    ...newItemIds
  ];

  let reason: RequestSelectionResendEligibilityReason;
  if (input.activeBatch) reason = 'ACTIVE_SENT_BATCH_EXISTS';
  else if (!input.sourceBatch) reason = 'NO_FINALIZED_SELECTION';
  else if (input.currentInvoice?.status === 'DRAFT') reason = 'INVOICE_DRAFT_EXISTS';
  else if (input.currentInvoice) reason = 'INVOICE_ALREADY_SENT';
  else if (
    input.request.status !== 'AWAITING_INVOICE'
    && input.request.status !== 'WAITING_APPROVAL'
  ) reason = 'REQUEST_STATUS_BLOCKED';
  else if (changedRejectedItemIds.length > 0 && newItemIds.length > 0) {
    reason = 'HAS_REJECTED_AND_NEW_ITEMS';
  } else if (changedRejectedItemIds.length > 0) {
    reason = 'HAS_REJECTED_CHANGES';
  } else if (newItemIds.length > 0) {
    reason = 'HAS_NEW_REPLACEMENT_ITEMS';
  } else {
    reason = 'NO_FOLLOW_UP_CHANGES';
  }
  const canSend = reason === 'HAS_REJECTED_CHANGES'
    || reason === 'HAS_NEW_REPLACEMENT_ITEMS'
    || reason === 'HAS_REJECTED_AND_NEW_ITEMS';

  return {
    requestId: input.request.id,
    requestStatus: input.request.status,
    activeBatchId: input.activeBatch?.id ?? null,
    activeRevision: input.activeBatch?.revision ?? null,
    items,
    eligibleItemIds: canSend ? followUpCandidateItemIds : [],
    notSentItemIds: [],
    changedItemIds: changedRejectedItemIds,
    newItemIds,
    unchangedItemIds,
    removedBatchItemIds: removedRejectedSourceIds,
    hasUnpublishedSelectionChanges: false,
    finalizedSelectionLocked: true,
    mode: 'FOLLOW_UP_REJECTED',
    sourceBatch: input.sourceBatch
      ? {
          id: input.sourceBatch.id,
          revision: input.sourceBatch.revision,
          status: input.sourceBatch.status
        }
      : null,
    currentInvoice: input.currentInvoice,
    approvedLockedItemIds,
    rejectedEditableItemIds,
    changedRejectedItemIds,
    removedRejectedSourceIds,
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
    const [request, activeBatches, finalizedBatch] = await Promise.all([
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
      }),
      db.requestSelectionBatch.findFirst({
        where: {
          requestId: input.requestId,
          status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] }
        },
        orderBy: [{ revision: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          revision: true,
          status: true
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

    if (finalizedBatch) {
      const locked = deriveRequestSelectionResendEligibility({
        request,
        activeBatch: activeBatches[0] ?? null
      });
      return {
        ...locked,
        eligibleItemIds: [],
        canSend: false,
        reason: 'REQUEST_STATUS_BLOCKED',
        finalizedSelectionLocked: true
      };
    }

    return deriveRequestSelectionResendEligibility({
      request,
      activeBatch: activeBatches[0] ?? null
    });
  };
}

export const getRequestSelectionResendEligibility =
  createRequestSelectionResendEligibilityService(prisma);
