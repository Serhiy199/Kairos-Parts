'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { getClientSelectionFeedback } from '@/lib/client/request-feedback';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { createChangeRequest } from '@/lib/change-requests/service';
import { approveClientCommercialOffer, rejectClientCommercialOffer } from '@/lib/commercial-offers/service';
import { parseClientOfferComment } from '@/lib/commercial-offers/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
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

const CLIENT_REQUEST_ITEM_EDIT_FIELDS = new Set(['name', 'catalogNumber', 'quantity', 'comment']);

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
