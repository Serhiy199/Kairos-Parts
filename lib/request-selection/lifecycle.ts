import type { RequestSelectionBatchStatus } from '@prisma/client';

export const REQUEST_SELECTION_BATCH_EVENTS = {
  SEND: 'SEND',
  APPROVE: 'APPROVE',
  PARTIALLY_APPROVE: 'PARTIALLY_APPROVE',
  REJECT: 'REJECT',
  SUPERSEDE: 'SUPERSEDE'
} as const;

export type RequestSelectionBatchEvent =
  (typeof REQUEST_SELECTION_BATCH_EVENTS)[keyof typeof REQUEST_SELECTION_BATCH_EVENTS];

export type RequestSelectionBatchTransitionDecision =
  | {
      outcome: 'allowed';
      nextStatus: RequestSelectionBatchStatus;
    }
  | {
      outcome: 'noop';
      currentStatus: RequestSelectionBatchStatus;
      reason: 'already_in_target_status';
    }
  | {
      outcome: 'blocked';
      currentStatus: RequestSelectionBatchStatus;
      reason: 'final_status_locked' | 'invalid_transition';
    };

const targetByEvent: Record<RequestSelectionBatchEvent, RequestSelectionBatchStatus> = {
  SEND: 'SENT',
  APPROVE: 'APPROVED',
  PARTIALLY_APPROVE: 'PARTIALLY_APPROVED',
  REJECT: 'REJECTED',
  SUPERSEDE: 'SUPERSEDED'
};

const finalStatuses = new Set<RequestSelectionBatchStatus>([
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'SUPERSEDED'
]);

export function resolveRequestSelectionBatchTransition(
  currentStatus: RequestSelectionBatchStatus,
  event: RequestSelectionBatchEvent
): RequestSelectionBatchTransitionDecision {
  const targetStatus = targetByEvent[event];

  if (currentStatus === targetStatus) {
    return {
      outcome: 'noop',
      currentStatus,
      reason: 'already_in_target_status'
    };
  }

  if (finalStatuses.has(currentStatus)) {
    return {
      outcome: 'blocked',
      currentStatus,
      reason: 'final_status_locked'
    };
  }

  if (
    (currentStatus === 'DRAFT' && (event === 'SEND' || event === 'SUPERSEDE'))
    || (
      currentStatus === 'SENT'
      && (
        event === 'APPROVE'
        || event === 'PARTIALLY_APPROVE'
        || event === 'REJECT'
        || event === 'SUPERSEDE'
      )
    )
  ) {
    return { outcome: 'allowed', nextStatus: targetStatus };
  }

  return {
    outcome: 'blocked',
    currentStatus,
    reason: 'invalid_transition'
  };
}
