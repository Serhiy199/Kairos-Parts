import type { Prisma, RequestStatus } from '@prisma/client';

import { normalizeRequestStatusForSelection } from '@/lib/requests/statuses';

export const FINAL_CLIENT_SELECTION_LOCK_MESSAGE =
  'Клієнт уже завершив погодження. Підбір зафіксований і більше не може бути змінений. Для додаткових деталей потрібно створити нову заявку.';

export type ManagerSelectionMutationErrorCode =
  | 'ACTOR_NOT_ALLOWED'
  | 'REQUEST_STATUS_LOCKED'
  | 'FINAL_CLIENT_SELECTION_LOCKED'
  | 'ACTIVE_BATCH_INTEGRITY_ERROR';

export class ManagerSelectionMutationError extends Error {
  constructor(
    readonly code: ManagerSelectionMutationErrorCode,
    readonly context: {
      requestId: string;
      requestStatus: RequestStatus;
    }
  ) {
    super(
      code === 'FINAL_CLIENT_SELECTION_LOCKED'
        ? FINAL_CLIENT_SELECTION_LOCK_MESSAGE
        : `Manager selection mutation blocked: ${code}.`
    );
    this.name = 'ManagerSelectionMutationError';
  }
}

type MutationPolicyDatabase = Pick<
  Prisma.TransactionClient,
  'user' | 'requestSelectionBatch'
>;

export async function assertManagerSelectionMutationAllowed(
  tx: MutationPolicyDatabase,
  input: {
    requestId: string;
    requestStatus: RequestStatus;
    actorId: string;
  }
) {
  const [actor, activeBatches, finalizedBatch] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.actorId },
      select: { role: true, status: true }
    }),
    tx.requestSelectionBatch.findMany({
      where: { requestId: input.requestId, status: 'SENT' },
      orderBy: [{ revision: 'desc' }, { id: 'asc' }],
      take: 2,
      select: { id: true, revision: true, status: true }
    }),
    tx.requestSelectionBatch.findFirst({
      where: {
        requestId: input.requestId,
        status: { in: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] }
      },
      orderBy: [{ revision: 'desc' }, { id: 'asc' }],
      select: { id: true, revision: true, status: true }
    })
  ]);

  if (
    !actor
    || actor.status !== 'ACTIVE'
    || (actor.role !== 'ADMIN' && actor.role !== 'MANAGER')
  ) {
    throw new ManagerSelectionMutationError('ACTOR_NOT_ALLOWED', {
      requestId: input.requestId,
      requestStatus: input.requestStatus
    });
  }

  if (finalizedBatch) {
    throw new ManagerSelectionMutationError('FINAL_CLIENT_SELECTION_LOCKED', {
      requestId: input.requestId,
      requestStatus: input.requestStatus
    });
  }

  if (activeBatches.length > 1) {
    throw new ManagerSelectionMutationError('ACTIVE_BATCH_INTEGRITY_ERROR', {
      requestId: input.requestId,
      requestStatus: input.requestStatus
    });
  }

  const status = normalizeRequestStatusForSelection(input.requestStatus);
  if (status === 'NEW' || status === 'IN_PROGRESS') {
    if (activeBatches.length === 0) {
      return { activeBatch: null };
    }
    throw new ManagerSelectionMutationError('ACTIVE_BATCH_INTEGRITY_ERROR', {
      requestId: input.requestId,
      requestStatus: input.requestStatus
    });
  }
  if (status === 'WAITING_APPROVAL' && activeBatches.length === 1) {
    return { activeBatch: activeBatches[0] };
  }

  throw new ManagerSelectionMutationError('REQUEST_STATUS_LOCKED', {
    requestId: input.requestId,
    requestStatus: input.requestStatus
  });
}
