import type { Prisma, RequestStatus, UserRole } from '@prisma/client';

import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';

export const REQUEST_STATUS_EVENTS = {
  SELECTION_DRAFT_CREATED: 'SELECTION_DRAFT_CREATED',
  SELECTION_SENT_FOR_APPROVAL: 'SELECTION_SENT_FOR_APPROVAL',
  CLIENT_SELECTION_APPROVED: 'CLIENT_SELECTION_APPROVED',
  INVOICE_SENT: 'INVOICE_SENT',
  MANUAL_SET_AWAITING_SHIPMENT: 'MANUAL_SET_AWAITING_SHIPMENT',
  MANUAL_SET_COMPLETED: 'MANUAL_SET_COMPLETED',
  MANUAL_SET_CANCELLED: 'MANUAL_SET_CANCELLED'
} as const;

export type RequestStatusEvent = (typeof REQUEST_STATUS_EVENTS)[keyof typeof REQUEST_STATUS_EVENTS];

export const AUTOMATIC_REQUEST_STATUS_EVENTS = [
  REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED,
  REQUEST_STATUS_EVENTS.SELECTION_SENT_FOR_APPROVAL,
  REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED,
  REQUEST_STATUS_EVENTS.INVOICE_SENT
] as const satisfies readonly RequestStatusEvent[];

export const MANUAL_REQUEST_STATUS_EVENTS = [
  REQUEST_STATUS_EVENTS.MANUAL_SET_AWAITING_SHIPMENT,
  REQUEST_STATUS_EVENTS.MANUAL_SET_COMPLETED,
  REQUEST_STATUS_EVENTS.MANUAL_SET_CANCELLED
] as const satisfies readonly RequestStatusEvent[];

const automaticEvents = new Set<RequestStatusEvent>(AUTOMATIC_REQUEST_STATUS_EVENTS);
const staffRoles = new Set<UserRole>(['ADMIN', 'MANAGER']);

export type RequestStatusActor = {
  id: string;
};

export type RequestStatusTransitionMetadata = {
  source?: 'ADMIN_CRM' | 'CLIENT_CABINET' | 'SYSTEM';
  eventKey?: string;
  correlationId?: string;
  triggerEntityType?: 'REQUEST_ITEM' | 'INVOICE' | 'REQUEST';
  triggerEntityId?: string;
};

export type TransitionRequestStatusInput = {
  requestId: string;
  event: RequestStatusEvent;
  actor: RequestStatusActor;
  reason?: string;
  metadata?: RequestStatusTransitionMetadata;
  tx?: Prisma.TransactionClient;
};

export type RequestStatusTransitionBlockedReason =
  | 'terminal_status'
  | 'manual_status_locked'
  | 'invalid_transition';

export type RequestStatusTransitionResult =
  | {
      outcome: 'changed';
      previousStatus: RequestStatus;
      nextStatus: RequestStatus;
      historyId: string;
      auditLogId: string;
    }
  | {
      outcome: 'noop';
      currentStatus: RequestStatus;
      reason: 'already_in_target_status' | 'idempotent_event';
    }
  | {
      outcome: 'blocked';
      currentStatus: RequestStatus;
      reason: RequestStatusTransitionBlockedReason;
    };

export type RequestStatusTransitionErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'ROLE_NOT_ALLOWED'
  | 'CONCURRENT_STATUS_CHANGE';

export class RequestStatusTransitionError extends Error {
  constructor(
    readonly code: RequestStatusTransitionErrorCode,
    message: string,
    readonly context: {
      requestId: string;
      event: RequestStatusEvent;
      currentStatus?: RequestStatus;
    }
  ) {
    super(message);
    this.name = 'RequestStatusTransitionError';
  }
}

type AllowedDecision = {
  outcome: 'allowed';
  nextStatus: RequestStatus;
};

export type RequestStatusTransitionDecision =
  | AllowedDecision
  | Extract<RequestStatusTransitionResult, { outcome: 'noop' | 'blocked' }>;

const terminalStatuses = new Set<RequestStatus>(['COMPLETED', 'CANCELLED']);
const automaticLockedStatuses = new Set<RequestStatus>([
  'AWAITING_SHIPMENT',
  'ORDERED',
  'IN_DELIVERY'
]);

function allowed(nextStatus: RequestStatus): AllowedDecision {
  return { outcome: 'allowed', nextStatus };
}

function noop(currentStatus: RequestStatus): RequestStatusTransitionDecision {
  return { outcome: 'noop', currentStatus, reason: 'idempotent_event' };
}

function blocked(
  currentStatus: RequestStatus,
  reason: RequestStatusTransitionBlockedReason
): RequestStatusTransitionDecision {
  return { outcome: 'blocked', currentStatus, reason };
}

function resolveManualTransition(
  currentStatus: RequestStatus,
  event: Extract<RequestStatusEvent, `MANUAL_SET_${string}`>
): RequestStatusTransitionDecision {
  const targetByEvent: Record<typeof event, RequestStatus> = {
    MANUAL_SET_AWAITING_SHIPMENT: 'AWAITING_SHIPMENT',
    MANUAL_SET_COMPLETED: 'COMPLETED',
    MANUAL_SET_CANCELLED: 'CANCELLED'
  };
  const nextStatus = targetByEvent[event];

  if (currentStatus === nextStatus) {
    return { outcome: 'noop', currentStatus, reason: 'already_in_target_status' };
  }
  if (terminalStatuses.has(currentStatus)) {
    return blocked(currentStatus, 'terminal_status');
  }
  return allowed(nextStatus);
}

export function resolveRequestStatusTransition(
  currentStatus: RequestStatus,
  event: RequestStatusEvent
): RequestStatusTransitionDecision {
  if (event === REQUEST_STATUS_EVENTS.MANUAL_SET_AWAITING_SHIPMENT
    || event === REQUEST_STATUS_EVENTS.MANUAL_SET_COMPLETED
    || event === REQUEST_STATUS_EVENTS.MANUAL_SET_CANCELLED) {
    return resolveManualTransition(currentStatus, event);
  }

  if (terminalStatuses.has(currentStatus)) {
    return blocked(currentStatus, 'terminal_status');
  }
  if (automaticLockedStatuses.has(currentStatus)) {
    return blocked(currentStatus, 'manual_status_locked');
  }

  if (event === REQUEST_STATUS_EVENTS.SELECTION_DRAFT_CREATED) {
    if (currentStatus === 'NEW') return allowed('IN_PROGRESS');
    if (currentStatus === 'IN_PROGRESS') return noop(currentStatus);
  }

  if (event === REQUEST_STATUS_EVENTS.SELECTION_SENT_FOR_APPROVAL) {
    if (currentStatus === 'IN_PROGRESS' || currentStatus === 'OFFER_PREPARING') {
      return allowed('WAITING_APPROVAL');
    }
    if (currentStatus === 'WAITING_APPROVAL') return noop(currentStatus);
  }

  if (event === REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED) {
    if (currentStatus === 'WAITING_APPROVAL') return allowed('AWAITING_INVOICE');
    if (currentStatus === 'AWAITING_INVOICE') return noop(currentStatus);
  }

  if (event === REQUEST_STATUS_EVENTS.INVOICE_SENT) {
    if (currentStatus === 'AWAITING_INVOICE') return allowed('INVOICE_SENT');
    if (currentStatus === 'INVOICE_SENT') return noop(currentStatus);
  }

  return blocked(currentStatus, 'invalid_transition');
}

function roleAllowedForEvent(role: UserRole, event: RequestStatusEvent) {
  if (event === REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED) {
    return role === 'CLIENT';
  }
  return staffRoles.has(role);
}

function isAutomaticEvent(event: RequestStatusEvent) {
  return automaticEvents.has(event);
}

async function executeRequestStatusTransition(
  tx: Prisma.TransactionClient,
  input: Omit<TransitionRequestStatusInput, 'tx'>
): Promise<RequestStatusTransitionResult> {
  const [request, actor] = await Promise.all([
    tx.request.findUnique({
      where: { id: input.requestId },
      select: { id: true, requestNumber: true, status: true }
    }),
    tx.user.findUnique({
      where: { id: input.actor.id },
      select: { id: true, role: true }
    })
  ]);

  if (!request) {
    throw new RequestStatusTransitionError(
      'REQUEST_NOT_FOUND',
      `Request ${input.requestId} was not found for ${input.event}.`,
      { requestId: input.requestId, event: input.event }
    );
  }

  if (!actor || !roleAllowedForEvent(actor.role, input.event)) {
    throw new RequestStatusTransitionError(
      'ROLE_NOT_ALLOWED',
      `Actor ${input.actor.id} is not allowed to apply ${input.event}.`,
      { requestId: input.requestId, event: input.event, currentStatus: request.status }
    );
  }

  const decision = resolveRequestStatusTransition(request.status, input.event);
  if (decision.outcome !== 'allowed') return decision;

  const updated = await tx.request.updateMany({
    where: { id: request.id, status: request.status },
    data: { status: decision.nextStatus }
  });

  if (updated.count !== 1) {
    const latest = await tx.request.findUnique({
      where: { id: request.id },
      select: { status: true }
    });
    if (!latest) {
      throw new RequestStatusTransitionError(
        'REQUEST_NOT_FOUND',
        `Request ${input.requestId} disappeared during ${input.event}.`,
        { requestId: input.requestId, event: input.event }
      );
    }

    const concurrentDecision = resolveRequestStatusTransition(latest.status, input.event);
    if (concurrentDecision.outcome !== 'allowed') return concurrentDecision;

    throw new RequestStatusTransitionError(
      'CONCURRENT_STATUS_CHANGE',
      `Request ${input.requestId} changed concurrently while applying ${input.event}.`,
      { requestId: input.requestId, event: input.event, currentStatus: latest.status }
    );
  }

  const history = await tx.requestStatusHistory.create({
    data: {
      requestId: request.id,
      oldStatus: request.status,
      newStatus: decision.nextStatus,
      changedByUserId: actor.id
    },
    select: { id: true }
  });

  const auditLog = await writeAuditLog(tx, {
    actor: auditUserActor(actor.id),
    entityType: 'REQUEST',
    entityId: request.id,
    entityLabel: request.requestNumber,
    action: 'REQUEST_STATUS_CHANGED',
    category: 'STANDARD',
    oldValue: { status: request.status },
    newValue: { status: decision.nextStatus },
    metadata: {
      businessEvent: input.event,
      reason: input.reason,
      automatic: isAutomaticEvent(input.event),
      ...input.metadata
    },
    allowedFields: {
      oldValue: ['status'],
      newValue: ['status'],
      metadata: [
        'businessEvent',
        'reason',
        'automatic',
        'source',
        'eventKey',
        'correlationId',
        'triggerEntityType',
        'triggerEntityId'
      ]
    }
  });

  return {
    outcome: 'changed',
    previousStatus: request.status,
    nextStatus: decision.nextStatus,
    historyId: history.id,
    auditLogId: auditLog.id
  };
}

type TransactionRunner = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

export function createRequestStatusTransitionService(database: TransactionRunner) {
  return async function requestStatusTransition(
    input: TransitionRequestStatusInput
  ): Promise<RequestStatusTransitionResult> {
    const { tx, ...transitionInput } = input;
    if (tx) return executeRequestStatusTransition(tx, transitionInput);
    return database.$transaction((transaction) =>
      executeRequestStatusTransition(transaction, transitionInput)
    );
  };
}

export const transitionRequestStatus = createRequestStatusTransitionService(prisma);
