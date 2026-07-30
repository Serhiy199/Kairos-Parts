'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { getClientSelectionFeedback } from '@/lib/client/request-feedback';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { createChangeRequest } from '@/lib/change-requests/service';
import { approveClientCommercialOffer, rejectClientCommercialOffer } from '@/lib/commercial-offers/service';
import { parseClientOfferComment } from '@/lib/commercial-offers/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import {
  CLIENT_SELECTION_DECISIONS,
  ClientSelectionDecisionError,
  decideClientSelectionItem
} from '@/lib/request-selection/client-decision';
import {
  SubmitClientSelectionError,
  submitClientSelection
} from '@/lib/request-selection/client-submission';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string): never {
  redirect(`/client/requests/${requestId}?result=${result}`);
}

const selectionDecisionFeedback: Partial<
  Record<ClientSelectionDecisionError['code'], string>
> = {
  REQUEST_ACCESS_DENIED: 'selection-decision-forbidden',
  ACTOR_NOT_ALLOWED: 'selection-decision-forbidden',
  BATCH_NOT_FOUND: 'selection-decision-stale',
  BATCH_ITEM_NOT_FOUND: 'selection-decision-stale',
  BATCH_NOT_ACTIVE: 'selection-decision-stale',
  STALE_SELECTION_REVISION: 'selection-decision-stale',
  REQUEST_STATUS_DOES_NOT_ALLOW_CLIENT_DECISION: 'selection-decision-stale',
  BATCH_ITEM_ALREADY_DECIDED: 'selection-decision-conflict',
  BATCH_ITEM_DECISION_CONFLICT: 'selection-decision-conflict',
  REJECTION_COMMENT_REQUIRED: 'selection-rejection-comment-required',
  REJECTION_COMMENT_INVALID: 'selection-rejection-comment-invalid',
  CONCURRENT_SELECTION_DECISION: 'selection-decision-stale',
  REQUEST_APPROVAL_FINALIZATION_INVARIANT_FAILED:
    'selection-finalization-invariant-failed'
};

const aggregateSubmissionFeedback: Partial<
  Record<SubmitClientSelectionError['code'], string>
> = {
  REQUEST_ACCESS_DENIED: 'selection-submit-forbidden',
  ACTOR_NOT_ALLOWED: 'selection-submit-forbidden',
  ACTOR_NOT_FOUND: 'selection-submit-forbidden',
  BATCH_NOT_FOUND: 'selection-submit-stale',
  BATCH_NOT_ACTIVE: 'selection-submit-stale',
  STALE_SELECTION_REVISION: 'selection-submit-stale',
  REQUEST_STATUS_DOES_NOT_ALLOW_SUBMISSION: 'selection-submit-stale',
  CONCURRENT_SUBMISSION: 'selection-submit-stale',
  DUPLICATE_BATCH_ITEM_ID: 'selection-submit-validation',
  UNKNOWN_BATCH_ITEM_ID: 'selection-submit-validation',
  EMPTY_BATCH: 'selection-submit-validation',
  SUBMISSION_CONFLICT: 'selection-submit-conflict',
  BATCH_TRANSITION_FAILED: 'selection-submit-error',
  REQUEST_STATUS_TRANSITION_FAILED: 'selection-submit-error',
  FINALIZATION_INVARIANT_FAILED: 'selection-submit-error',
  AUDIT_WRITE_FAILED: 'selection-submit-error',
  DATABASE_TRANSACTION_FAILED: 'selection-submit-error'
};

export async function submitClientSelectionAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const batchId = readString(formData, 'batchId');
  const revision = Number(readString(formData, 'revision'));
  const approvedBatchItemIds = formData
    .getAll('approvedBatchItemIds')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim());

  if (
    !hasDatabaseUrl()
    || !requestId
    || !batchId
    || !Number.isSafeInteger(revision)
    || revision < 1
  ) {
    return {
      ok: false as const,
      feedback: getClientSelectionFeedback('selection-submit-validation'),
      refresh: false
    };
  }

  try {
    const result = await submitClientSelection({
      requestId,
      batchId,
      expectedRevision: revision,
      approvedBatchItemIds,
      actor: { id: session.user.id },
      source: 'CLIENT_CABINET',
      requestContext: await getServerAuditRequestContext()
    });
    const feedback = result.outcome === 'noop'
      ? 'selection-submit-noop'
      : result.batchStatus === 'APPROVED'
        ? 'selection-submit-approved'
        : result.batchStatus === 'PARTIALLY_APPROVED'
          ? 'selection-submit-partial'
          : 'selection-submit-rejected';

    revalidatePath('/client/requests');
    revalidatePath(`/client/requests/${requestId}`);
    revalidatePath('/admin');
    revalidatePath('/admin/requests');
    revalidatePath(`/admin/requests/${requestId}`);

    return {
      ok: true as const,
      feedback: getClientSelectionFeedback(feedback),
      refresh: true
    };
  } catch (error) {
    if (error instanceof SubmitClientSelectionError) {
      const code =
        aggregateSubmissionFeedback[error.code] ?? 'selection-submit-error';
      return {
        ok: false as const,
        feedback: getClientSelectionFeedback(code),
        refresh: code === 'selection-submit-stale'
      };
    }
    console.error('Aggregate client selection submission failed.', {
      requestId,
      batchId,
      revision
    });
    return {
      ok: false as const,
      feedback: getClientSelectionFeedback('selection-submit-error'),
      refresh: false
    };
  }
}

export async function decideClientSelectionItemAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const batchId = readString(formData, 'batchId');
  const batchItemId = readString(formData, 'batchItemId');
  const revisionValue = Number(readString(formData, 'revision'));
  const decisionValue = readString(formData, 'decision');

  if (
    !hasDatabaseUrl()
    || !requestId
    || !batchId
    || !batchItemId
    || !Number.isSafeInteger(revisionValue)
    || revisionValue < 1
    || (decisionValue !== CLIENT_SELECTION_DECISIONS.APPROVE
      && decisionValue !== CLIENT_SELECTION_DECISIONS.REJECT)
  ) {
    return { ok: false as const, feedback: getClientSelectionFeedback('selection-decision-error'), refresh: false };
  }

  let feedback: string;
  try {
    const result = await decideClientSelectionItem({
      requestId,
      batchId,
      batchItemId,
      expectedRevision: revisionValue,
      decision: decisionValue,
      clientComment: readString(formData, 'clientComment'),
      actor: { id: session.user.id },
      source: 'CLIENT_CABINET',
      requestContext: await getServerAuditRequestContext()
    });
    if (result.outcome === 'noop') {
      feedback = 'selection-decision-noop';
    } else if (result.batchOutcome === 'approved') {
      feedback = 'selection-fully-approved';
    } else if (result.batchOutcome === 'partially_approved') {
      feedback = 'selection-partially-approved';
    } else if (result.batchOutcome === 'rejected') {
      feedback = 'selection-fully-rejected';
    } else if (result.decision === CLIENT_SELECTION_DECISIONS.REJECT) {
      feedback = 'selection-item-rejected-pending';
    } else {
      feedback = 'selection-item-approved';
    }
  } catch (error) {
    if (error instanceof ClientSelectionDecisionError) {
      const code = selectionDecisionFeedback[error.code] ?? 'selection-decision-error';
      return {
        ok: false as const,
        feedback: getClientSelectionFeedback(code),
        refresh: code === 'selection-decision-stale'
      };
    }
    console.error('Client selection decision failed.', {
      requestId,
      batchId,
      batchItemId
    });
    return { ok: false as const, feedback: getClientSelectionFeedback('selection-decision-error') };
  }

  revalidatePath('/client/requests');
  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true as const, feedback: getClientSelectionFeedback(feedback), refresh: true };
}

const CLIENT_REQUEST_ITEM_EDIT_FIELDS = new Set(['name', 'catalogNumber', 'quantity', 'comment']);

function readItemIds(formData: FormData) {
  return formData
    .getAll('itemIds')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function approveClientCommercialOfferAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');

  if (!hasDatabaseUrl() || !requestId || !offerId) {
    redirectBack(requestId, 'offer-error');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const result = await approveClientCommercialOffer(offerId, access, await getServerAuditRequestContext());

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-approved');
}

export async function rejectClientCommercialOfferAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');

  if (!hasDatabaseUrl() || !requestId || !offerId) {
    redirectBack(requestId, 'offer-error');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const result = await rejectClientCommercialOffer(
    offerId,
    access,
    parseClientOfferComment(formData),
    await getServerAuditRequestContext()
  );

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-rejected');
}

export async function approveClientRequestItemsAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const selectedItemIds = readItemIds(formData);

  if (!hasDatabaseUrl() || !requestId) {
    redirectBack(requestId, 'items-approval-error');
  }

  if (selectedItemIds.length === 0) {
    redirectBack(requestId, 'item-selection-required');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const request = await prisma.request.findFirst({
    where: { id: requestId, AND: [requestAccessWhere(access)] },
    select: {
      id: true,
      requestNumber: true,
      companyId: true,
      items: {
        where: { visibleToClient: true },
        select: { id: true, approvedByClient: true }
      }
    }
  });

  if (!request) {
    redirectBack(requestId, 'items-approval-forbidden');
  }

  const visibleItemIds = new Set(request.items.map((item) => item.id));
  const selectedVisibleIds = selectedItemIds.filter((itemId) => visibleItemIds.has(itemId));

  if (selectedVisibleIds.length !== selectedItemIds.length) {
    redirectBack(requestId, 'items-approval-forbidden');
  }

  const now = new Date();
  const previouslyApprovedIds = request.items.filter((item) => item.approvedByClient).map((item) => item.id);
  const rejectedIds = request.items.map((item) => item.id).filter((itemId) => !selectedVisibleIds.includes(itemId));
  const requestContext = await getServerAuditRequestContext();

  await prisma.$transaction(async (tx) => {
    await tx.requestItem.updateMany({
      where: { requestId: request.id, visibleToClient: true, id: { in: selectedVisibleIds } },
      data: { includeInInvoice: true, approvedByClient: true, approvedAt: now }
    });
    await tx.requestItem.updateMany({
      where: { requestId: request.id, visibleToClient: true, id: { notIn: selectedVisibleIds } },
      data: { includeInInvoice: false, approvedByClient: false, approvedAt: null }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: request.companyId,
      entityType: 'REQUEST',
      entityId: request.id,
      entityLabel: `Заявка ${request.requestNumber}`,
      action: 'REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED',
      category: 'STANDARD',
      oldValue: { approvedItemIds: previouslyApprovedIds.slice(0, 50) },
      newValue: { approvedItemIds: selectedVisibleIds.slice(0, 50) },
      metadata: {
        source: 'CLIENT_CABINET',
        approvedItemCount: selectedVisibleIds.length,
        rejectedItemCount: rejectedIds.length,
        rejectedItemIds: rejectedIds.slice(0, 50)
      },
      allowedFields: {
        oldValue: ['approvedItemIds'],
        newValue: ['approvedItemIds'],
        metadata: ['source', 'approvedItemCount', 'rejectedItemCount', 'rejectedItemIds']
      },
      requestContext
    });
  });

  revalidatePath(`/client/requests/${request.id}`);
  revalidatePath('/client');
  revalidatePath('/client/requests');
  revalidatePath(`/admin/requests/${request.id}`);
  redirectBack(request.id, 'items-approved');
}

export async function createClientRequestItemEditAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');
  const fieldName = readString(formData, 'fieldName');
  const newValue = readString(formData, 'newValue');
  const reason = readString(formData, 'reason');

  if (!hasDatabaseUrl() || !requestId || !itemId) {
    redirectBack(requestId, 'item-change-error');
  }

  if (!CLIENT_REQUEST_ITEM_EDIT_FIELDS.has(fieldName)) {
    redirectBack(requestId, 'item-change-field-forbidden');
  }

  if (!newValue && !reason) {
    redirectBack(requestId, 'item-change-required');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const item = await prisma.requestItem.findFirst({
    where: {
      id: itemId,
      requestId,
      visibleToClient: true,
      request: requestAccessWhere(access)
    },
    select: {
      id: true,
      requestId: true,
      name: true,
      catalogNumber: true,
      quantity: true,
      comment: true
    }
  });

  if (!item) {
    redirectBack(requestId, 'item-change-forbidden');
  }

  const currentValue = item[fieldName as keyof typeof item];
  const result = await createChangeRequest(access, {
    entityType: 'REQUEST_ITEM',
    entityId: item.id,
    action: 'UPDATE',
    fieldName,
    oldValue: { [fieldName]: currentValue ?? null },
    newValue: newValue ? { [fieldName]: newValue } : undefined,
    reason: reason || null
  });

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath('/client/change-requests');
  revalidatePath('/admin/change-requests');
  redirectBack(requestId, 'item-change-created');
}
