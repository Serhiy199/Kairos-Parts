'use server';

import { UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { getAdminWorkflowFeedback } from '@/lib/admin/request-feedback';
import type { WorkflowActionResult } from '@/lib/actions/workflow-result';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  cancelCommercialOffer,
  createCommercialOfferFromRequest,
  deleteDraftCommercialOffer,
  sendCommercialOffer,
  updateCommercialOfferItem,
  updateCommercialOfferMetadata
} from '@/lib/commercial-offers/service';
import { parseCommercialOfferItemInput, parseCommercialOfferMetadata } from '@/lib/commercial-offers/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { saveRequestDocumentLocal } from '@/lib/files/local-storage';
import {
  cancelInvoice,
  createInvoiceFromApprovedSelection,
  markInvoicePaid,
  sendInvoiceToClient
} from '@/lib/invoices/service';
import { notifyRequestStatusChange } from '@/lib/notifications/status-change';
import { runOcrForRequestFile, updateOcrCorrection } from '@/lib/ocr/service';
import { prisma } from '@/lib/prisma';
import { parseRequestDocumentMetadata, readRequiredRequestDocumentFile } from '@/lib/request-documents/validation';
import {
  createRequestItemDraft,
  RequestItemDraftCreateError
} from '@/lib/request-items/create-draft';
import {
  RequestItemUpdateError,
  updateRequestItem
} from '@/lib/request-items/update';
import {
  deleteRequestItem,
  RequestItemDeleteError
} from '@/lib/request-items/delete';
import {
  parseRequestItemInput,
  parseRequestItemUpdateInput
} from '@/lib/request-items/validation';
import {
  sendRequestSelectionForApproval,
  SendRequestSelectionForApprovalError,
  type RequestSelectionSourceVersion
} from '@/lib/request-selection/send-for-approval';
import {
  isManualRequestStatus,
  type ManualRequestStatus
} from '@/lib/requests/statuses';
import {
  REQUEST_STATUS_EVENTS,
  transitionRequestStatus
} from '@/lib/requests/status-transition';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string): never {
  redirect(`/admin/requests/${requestId}?result=${result}`);
}

function workflowResult(code: string, ok: boolean, refresh = true): WorkflowActionResult {
  return { ok, feedback: getAdminWorkflowFeedback(code), refresh };
}

function getCrmRole(session: Awaited<ReturnType<typeof requireCrmSession>>): UserRole {
  return session.user.role === 'ADMIN' || session.user.role === 'MANAGER' ? session.user.role : 'GUEST';
}

async function getCrmAuditContext(session: Awaited<ReturnType<typeof requireCrmSession>>) {
  return {
    actorId: session.user.id,
    source: 'ADMIN_CRM' as const,
    requestContext: await getServerAuditRequestContext()
  };
}

async function getInvoiceAuditContext(session: Awaited<ReturnType<typeof requireCrmSession>>) {
  return {
    actorId: session.user.id,
    actorRole: getCrmRole(session),
    requestContext: await getServerAuditRequestContext()
  };
}

const REQUEST_DOCUMENT_AUDIT_FIELDS = [
  'documentId', 'fileName', 'documentType', 'title', 'visibility',
  'requestId', 'size', 'mimeType'
] as const;

function requestLabel(requestNumber: string) {
  return `Заявка ${requestNumber}`;
}

function isFinancialRequestDocument(type: string) {
  return type === 'INVOICE' || type === 'COMMERCIAL_OFFER';
}

function requestDocumentSnapshot(document: {
  id: string;
  requestId: string;
  type: string;
  title: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  visibleToClient: boolean;
}) {
  return {
    documentId: document.id,
    fileName: document.fileName,
    documentType: document.type,
    title: document.title,
    visibility: document.visibleToClient,
    requestId: document.requestId,
    size: document.size,
    mimeType: document.mimeType
  };
}

export async function updateAdminRequestStatus(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const intent = readString(formData, 'intent');
  const status = readString(formData, 'status');

  if (
    !hasDatabaseUrl()
    || !requestId
    || intent !== 'manual-status-change'
    || !isManualRequestStatus(status)
    || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')
  ) {
    redirectBack(requestId, 'status-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requestNumber: true, status: true, publicStatusToken: true, companyId: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  const eventByStatus: Record<ManualRequestStatus, typeof REQUEST_STATUS_EVENTS[
    'MANUAL_SET_AWAITING_SHIPMENT'
    | 'MANUAL_SET_COMPLETED'
    | 'MANUAL_SET_CANCELLED'
  ]> = {
    AWAITING_SHIPMENT: REQUEST_STATUS_EVENTS.MANUAL_SET_AWAITING_SHIPMENT,
    COMPLETED: REQUEST_STATUS_EVENTS.MANUAL_SET_COMPLETED,
    CANCELLED: REQUEST_STATUS_EVENTS.MANUAL_SET_CANCELLED
  };
  const result = await transitionRequestStatus({
    requestId: request.id,
    event: eventByStatus[status],
    actor: { id: session.user.id },
    reason: 'Ручна зміна статусу в CRM',
    metadata: { source: 'ADMIN_CRM' },
    requestContext: await getServerAuditRequestContext()
  });
  if (result.outcome === 'blocked') {
    redirectBack(request.id, 'status-error');
  }

  try {
    await notifyRequestStatusChange(request.id, status);
  } catch {
    // Status updates must not fail because a notification channel is unavailable.
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${request.id}`);
  revalidatePath(`/request/status/${request.publicStatusToken}`);
  redirectBack(request.id, 'status-updated');
}

export async function assignAdminRequestManager(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const assignedManagerId = readString(formData, 'assignedManagerId');

  if (!hasDatabaseUrl() || !requestId) {
    redirectBack(requestId, 'assign-error');
  }

  if (session.user.role !== 'ADMIN') {
    redirectBack(requestId, 'admin-only');
  }

  const existingRequest = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      companyId: true,
      assignedManager: { select: { id: true, name: true, email: true } }
    }
  });

  if (!existingRequest) {
    redirect('/admin/requests?result=request-not-found');
  }

  const manager = assignedManagerId
    ? await prisma.user.findFirst({
        where: { id: assignedManagerId, role: { in: ['MANAGER', 'ADMIN'] } },
        select: { id: true, name: true, email: true }
      })
    : null;

  if (assignedManagerId && !manager) {
    redirectBack(requestId, 'manager-not-found');
  }

  const action = !existingRequest.assignedManager && manager
    ? 'REQUEST_MANAGER_ASSIGNED' as const
    : existingRequest.assignedManager && !manager
      ? 'REQUEST_MANAGER_UNASSIGNED' as const
      : 'REQUEST_MANAGER_REASSIGNED' as const;
  const requestContext = await getServerAuditRequestContext();

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { assignedManagerId: manager?.id ?? null }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: existingRequest.companyId,
      entityType: 'REQUEST',
      entityId: existingRequest.id,
      entityLabel: requestLabel(existingRequest.requestNumber),
      action,
      category: 'STANDARD',
      oldValue: existingRequest.assignedManager ? {
        managerId: existingRequest.assignedManager.id,
        managerName: existingRequest.assignedManager.name,
        managerEmail: existingRequest.assignedManager.email
      } : { managerId: null, managerName: null, managerEmail: null },
      newValue: manager ? {
        managerId: manager.id,
        managerName: manager.name,
        managerEmail: manager.email
      } : { managerId: null, managerName: null, managerEmail: null },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: {
        oldValue: ['managerId', 'managerName', 'managerEmail'],
        newValue: ['managerId', 'managerName', 'managerEmail'],
        metadata: ['source']
      },
      requestContext
    });
  });

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'assigned');
}

export async function addAdminRequestComment(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const message = readString(formData, 'message');

  if (!hasDatabaseUrl() || !requestId || !message) {
    redirectBack(requestId, 'comment-error');
  }

  await prisma.requestComment.create({
    data: {
      requestId,
      authorId: session.user.id,
      message,
      internal: true
    }
  });

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'comment-added');
}

export async function runAdminRequestOcr(formData: FormData) {
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const fileId = readString(formData, 'fileId');

  if (!hasDatabaseUrl() || !requestId || !fileId) {
    redirectBack(requestId, 'ocr-error');
  }

  try {
    await runOcrForRequestFile({ requestId, fileId });
  } catch {
    redirectBack(requestId, 'ocr-error');
  }

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'ocr-created');
}

export async function updateAdminOcrCorrection(formData: FormData) {
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const ocrResultId = readString(formData, 'ocrResultId');
  const correctedText = readString(formData, 'correctedText');

  if (!hasDatabaseUrl() || !requestId || !ocrResultId) {
    redirectBack(requestId, 'ocr-correction-error');
  }

  await updateOcrCorrection({ ocrResultId, correctedText });

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'ocr-corrected');
}

export async function createAdminRequestItem(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const parsed = parseRequestItemInput(formData);

  if (!hasDatabaseUrl() || !requestId || !parsed.ok) {
    return workflowResult('item-error', false, false);
  }

  const requestContext = await getServerAuditRequestContext();
  let result: Awaited<ReturnType<typeof createRequestItemDraft>>;

  try {
    result = await createRequestItemDraft({
      requestId,
      data: parsed.data,
      actor: { id: session.user.id },
      requestContext
    });
  } catch (error) {
    if (error instanceof RequestItemDraftCreateError && error.code === 'REQUEST_NOT_FOUND') {
      return workflowResult('request-not-found', false);
    }
    if (
      error instanceof RequestItemDraftCreateError
      && (
        error.code === 'ACTOR_NOT_ALLOWED'
        || error.code === 'FINAL_CLIENT_SELECTION_LOCKED'
      )
    ) {
      return workflowResult('item-mutation-locked', false);
    }
    if (error instanceof RequestItemDraftCreateError
      && error.code === 'REQUEST_STATUS_DOES_NOT_ALLOW_ITEM_CREATION') {
      return workflowResult('item-status-locked', false);
    }
    return workflowResult('item-error', false);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${result.request.id}`);

  if (result.request.vehicleId) {
    revalidatePath(`/client/vehicles/${result.request.vehicleId}`);
  }

  return workflowResult('item-created', true);
}

export async function updateAdminRequestItem(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');
  const expectedUpdatedAt = readString(formData, 'expectedUpdatedAt');
  const parsed = parseRequestItemUpdateInput(formData);

  if (!hasDatabaseUrl() || !requestId || !itemId || !expectedUpdatedAt || !parsed.ok) {
    return workflowResult('item-validation-error', false, false);
  }

  const requestContext = await getServerAuditRequestContext();
  let result: Awaited<ReturnType<typeof updateRequestItem>>;
  try {
    result = await updateRequestItem({
      requestItemId: itemId,
      requestId,
      expectedUpdatedAt,
      actor: { id: session.user.id },
      values: parsed.data,
      requestContext
    });
  } catch (error) {
    const code = error instanceof RequestItemUpdateError
      ? error.code
      : 'REQUEST_ITEM_UPDATE_FAILED';
    console.error('Request item update failed.', {
      requestId,
      requestItemId: itemId,
      expectedUpdatedAt,
      errorCode: code
    });
    if (code === 'REQUEST_ITEM_NOT_FOUND' || code === 'REQUEST_ITEM_NOT_IN_REQUEST') {
      return workflowResult('item-not-found', false);
    }
    if (code === 'REQUEST_ITEM_VERSION_CONFLICT') {
      return workflowResult('item-stale', false);
    }
    if (code === 'REQUEST_ITEM_VALIDATION_FAILED') {
      return workflowResult('item-validation-error', false, false);
    }
    if (code === 'APPROVED_REQUEST_ITEM_LOCKED') {
      return workflowResult('item-approved-locked', false);
    }
    if (code === 'REQUEST_SELECTION_MUTATION_LOCKED') {
      return workflowResult('item-mutation-locked', false);
    }
    return workflowResult('item-update-error', false);
  }

  if (result.outcome === 'no_changes') {
    return workflowResult('item-no-changes', true, false);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${result.item.requestId}`);

  if (result.item.vehicleId) {
    revalidatePath(`/client/vehicles/${result.item.vehicleId}`);
  }

  return workflowResult('item-updated', true);
}

export async function sendAdminRequestItemsForApproval(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const requestItemIds = formData.getAll('requestItemId')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  const rawVersions = readString(formData, 'requestItemVersions');
  const modeValue = readString(formData, 'mode');
  const mode = modeValue === 'INITIAL' || modeValue === 'RESEND_ACTIVE'
    ? modeValue
    : null;
  const expectedActiveBatchId = readString(formData, 'expectedActiveBatchId');
  const expectedActiveRevisionRaw = readString(
    formData,
    'expectedActiveRevision'
  );
  const expectedActiveRevision = expectedActiveRevisionRaw
    ? Number(expectedActiveRevisionRaw)
    : undefined;

  if (modeValue === 'FOLLOW_UP_REJECTED') {
    return workflowResult('selection-finalized-locked', false, false);
  }

  if (
    !hasDatabaseUrl()
    || !requestId
    || !rawVersions
    || !mode
    || (
      mode === 'RESEND_ACTIVE'
      && (
        !expectedActiveBatchId
        || !Number.isSafeInteger(expectedActiveRevision)
      )
    )
  ) {
    return workflowResult('items-send-error', false, false);
  }

  let expectedRequestItemVersions: RequestSelectionSourceVersion[];
  try {
    const parsed = JSON.parse(rawVersions) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Expected an array.');
    expectedRequestItemVersions = parsed.map((entry) => {
      if (
        !entry
        || typeof entry !== 'object'
        || !('id' in entry)
        || !('updatedAt' in entry)
        || typeof entry.id !== 'string'
        || typeof entry.updatedAt !== 'string'
      ) {
        throw new Error('Invalid request item version.');
      }
      return { id: entry.id, updatedAt: new Date(entry.updatedAt) };
    });
  } catch {
    return workflowResult('items-send-stale', false);
  }

  const requestContext = await getServerAuditRequestContext();
  let notificationFailed = false;
  try {
    const result = await sendRequestSelectionForApproval({
      requestId,
      requestItemIds,
      expectedRequestItemVersions,
      expectedActiveBatchId: expectedActiveBatchId || undefined,
      expectedActiveRevision,
      actor: { id: session.user.id },
      mode,
      requestContext
    });
    notificationFailed = result.notification.status === 'failed';
    if (notificationFailed) {
      console.warn(`Telegram items approval notification failed for request ${requestId}.`);
    }
  } catch (error) {
    if (error instanceof SendRequestSelectionForApprovalError) {
      if (error.code === 'EMPTY_SELECTION') return workflowResult('items-send-empty', false);
      if (error.code === 'SOURCE_ITEM_VERSION_CONFLICT') {
        return workflowResult('items-send-stale', false);
      }
      if (
        error.code === 'ACTIVE_SELECTION_VERSION_CONFLICT'
        || error.code === 'ACTIVE_SENT_BATCH_CONFLICT'
        || error.code === 'BATCH_SUPERSEDE_FAILED'
      ) {
        return workflowResult('items-send-stale', false);
      }
      if (error.code === 'NO_SELECTION_CHANGES') {
        return workflowResult('selection-update-no-changes', false);
      }
      if (error.code === 'DUPLICATE_SEND_OPERATION') {
        return workflowResult('items-send-duplicate', false);
      }
      if (error.code === 'REQUEST_STATUS_DOES_NOT_ALLOW_SELECTION_SEND') {
        return workflowResult('items-send-status-locked', false);
      }
      if (error.code === 'FINALIZED_SELECTION_LOCKED') {
        return workflowResult('selection-finalized-locked', false);
      }
      if (error.code === 'REQUEST_NOT_FOUND') {
        return workflowResult('request-not-found', false);
      }
    }
    console.error('Failed to send request selection for approval.', {
      requestId,
      errorCode: error instanceof SendRequestSelectionForApprovalError ? error.code : 'UNEXPECTED'
    });
    return workflowResult('items-send-error', false);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath('/client');
  revalidatePath('/client/requests');
  revalidatePath(`/client/requests/${requestId}`);
  if (notificationFailed) {
    return workflowResult('items-sent-for-approval-notification-failed', true);
  }
  return workflowResult(
    mode === 'RESEND_ACTIVE'
      ? 'selection-updated-for-client'
      : 'items-sent-for-approval',
    true
  );
}

export async function deleteAdminRequestItem(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');

  if (!hasDatabaseUrl() || !requestId || !itemId) {
    return workflowResult('item-error', false, false);
  }

  const requestContext = await getServerAuditRequestContext();
  let result: Awaited<ReturnType<typeof deleteRequestItem>>;
  try {
    result = await deleteRequestItem({
      requestItemId: itemId,
      requestId,
      actor: { id: session.user.id },
      requestContext
    });
  } catch (error) {
    if (error instanceof RequestItemDeleteError) {
      if (error.code === 'REQUEST_ITEM_NOT_FOUND') {
        return workflowResult('item-not-found', false);
      }
      if (error.code === 'APPROVED_REQUEST_ITEM_DELETE_BLOCKED') {
        return workflowResult('item-approved-delete-blocked', false);
      }
      if (
        error.code === 'REQUEST_SELECTION_MUTATION_LOCKED'
        || error.code === 'ACTOR_NOT_ALLOWED'
      ) {
        return workflowResult('item-mutation-locked', false);
      }
    }
    console.error('Request item delete failed.', { requestId, requestItemId: itemId });
    return workflowResult('item-error', false);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${result.item.requestId}`);

  if (result.item.vehicleId) {
    revalidatePath(`/client/vehicles/${result.item.vehicleId}`);
  }

  return workflowResult('item-deleted', true);
}

export async function createAdminRequestDocument(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const metadata = parseRequestDocumentMetadata(formData);
  const fileResult = readRequiredRequestDocumentFile(formData);

  if (!hasDatabaseUrl() || !requestId || !metadata.ok || !fileResult.ok) {
    redirectBack(requestId, 'document-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requestNumber: true, companyId: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  try {
    const savedFile = await saveRequestDocumentLocal(request.id, fileResult.file);

    const requestContext = await getServerAuditRequestContext();
    await prisma.$transaction(async (tx) => {
      const document = await tx.requestDocument.create({
        data: {
          requestId: request.id,
          type: metadata.data.type,
          title: metadata.data.title,
          fileName: savedFile.fileName,
          fileUrl: savedFile.fileUrl,
          storageKey: savedFile.storageKey,
          mimeType: savedFile.mimeType,
          size: savedFile.size,
          visibleToClient: metadata.data.visibleToClient,
          uploadedById: session.user.id
        }
      });
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        companyId: request.companyId,
        entityType: 'REQUEST_DOCUMENT',
        entityId: document.id,
        entityLabel: document.title || document.fileName,
        action: 'DOCUMENT_UPLOADED',
        category: 'STANDARD',
        newValue: requestDocumentSnapshot(document),
        metadata: { source: 'ADMIN_CRM', requestNumber: request.requestNumber },
        allowedFields: { newValue: REQUEST_DOCUMENT_AUDIT_FIELDS, metadata: ['source', 'requestNumber'] },
        requestContext
      });
    });
  } catch (error) {
    console.error('Failed to upload request document', error);
    redirectBack(request.id, 'document-error');
  }

  revalidatePath(`/admin/requests/${request.id}`);
  revalidatePath(`/client/requests/${request.id}`);
  redirectBack(request.id, 'document-created');
}

export async function updateAdminRequestDocument(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const documentId = readString(formData, 'documentId');
  const metadata = parseRequestDocumentMetadata(formData);

  if (!hasDatabaseUrl() || !requestId || !documentId || !metadata.ok) {
    redirectBack(requestId, 'document-error');
  }

  const document = await prisma.requestDocument.findFirst({
    where: { id: documentId, requestId },
    include: { request: { select: { requestNumber: true, companyId: true } } }
  });

  if (!document) {
    redirectBack(requestId, 'document-not-found');
  }

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.requestDocument.update({ where: { id: document.id }, data: metadata.data });
    const before = requestDocumentSnapshot(document);
    const after = requestDocumentSnapshot(updated);
    const diff = buildAuditDiff(before, after, REQUEST_DOCUMENT_AUDIT_FIELDS);
    const action = before.title !== after.title && before.visibility === after.visibility && before.documentType === after.documentType
      ? 'DOCUMENT_RENAMED' as const
      : before.visibility !== after.visibility && before.title === after.title && before.documentType === after.documentType
        ? 'DOCUMENT_VISIBILITY_CHANGED' as const
        : 'DOCUMENT_UPDATED' as const;
    const category = before.documentType !== after.documentType
      && (isFinancialRequestDocument(before.documentType) || isFinancialRequestDocument(after.documentType))
      ? 'FINANCIAL_CRITICAL' as const
      : 'STANDARD' as const;
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: document.request.companyId,
      entityType: 'REQUEST_DOCUMENT',
      entityId: document.id,
      entityLabel: updated.title || updated.fileName,
      action,
      category,
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM', requestNumber: document.request.requestNumber },
      allowedFields: {
        oldValue: REQUEST_DOCUMENT_AUDIT_FIELDS,
        newValue: REQUEST_DOCUMENT_AUDIT_FIELDS,
        metadata: ['source', 'requestNumber']
      },
      requestContext
    });
  });

  revalidatePath(`/admin/requests/${document.requestId}`);
  revalidatePath(`/client/requests/${document.requestId}`);
  redirectBack(document.requestId, 'document-updated');
}

export async function deleteAdminRequestDocument(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const documentId = readString(formData, 'documentId');

  if (!hasDatabaseUrl() || !requestId || !documentId) {
    redirectBack(requestId, 'document-error');
  }

  const document = await prisma.requestDocument.findFirst({
    where: { id: documentId, requestId },
    include: { request: { select: { requestNumber: true, companyId: true } } }
  });

  if (!document) {
    redirectBack(requestId, 'document-not-found');
  }

  const snapshot = requestDocumentSnapshot(document);
  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: document.request.companyId,
      entityType: 'REQUEST_DOCUMENT',
      entityId: document.id,
      entityLabel: document.title || document.fileName,
      action: 'DOCUMENT_DELETED',
      category: isFinancialRequestDocument(document.type) ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      oldValue: snapshot,
      metadata: { source: 'ADMIN_CRM', requestNumber: document.request.requestNumber },
      allowedFields: { oldValue: REQUEST_DOCUMENT_AUDIT_FIELDS, metadata: ['source', 'requestNumber'] },
      requestContext
    });
    await tx.requestDocument.delete({ where: { id: document.id } });
  });

  revalidatePath(`/admin/requests/${document.requestId}`);
  revalidatePath(`/client/requests/${document.requestId}`);
  redirectBack(document.requestId, 'document-deleted');
}

export async function createAdminCommercialOffer(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');

  if (!hasDatabaseUrl() || !requestId) {
    redirectBack(requestId, 'offer-error');
  }

  const result = await createCommercialOfferFromRequest(requestId, await getCrmAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-created');
}

export async function updateAdminCommercialOfferMetadata(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');
  const parsed = parseCommercialOfferMetadata(formData);

  if (!hasDatabaseUrl() || !requestId || !offerId || !parsed.ok) {
    redirectBack(requestId, 'offer-error');
  }

  const result = await updateCommercialOfferMetadata(offerId, parsed.data, await getCrmAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-updated');
}

export async function updateAdminCommercialOfferItem(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');
  const itemId = readString(formData, 'offerItemId');
  const parsed = parseCommercialOfferItemInput(formData);

  if (!hasDatabaseUrl() || !requestId || !offerId || !itemId || !parsed.ok) {
    redirectBack(requestId, 'offer-error');
  }

  const result = await updateCommercialOfferItem(offerId, itemId, parsed.data, await getCrmAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-item-updated');
}

export async function sendAdminCommercialOffer(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');

  if (!hasDatabaseUrl() || !requestId || !offerId) {
    redirectBack(requestId, 'offer-error');
  }

  const result = await sendCommercialOffer(offerId, await getCrmAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  redirectBack(requestId, 'offer-sent');
}

export async function cancelAdminCommercialOffer(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');

  if (!hasDatabaseUrl() || !requestId || !offerId) {
    redirectBack(requestId, 'offer-error');
  }

  const result = await cancelCommercialOffer(offerId, await getCrmAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  redirectBack(requestId, 'offer-cancelled');
}

export async function deleteAdminCommercialOffer(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');

  if (!hasDatabaseUrl() || !requestId || !offerId) {
    redirectBack(requestId, 'offer-error');
  }

  const result = await deleteDraftCommercialOffer(offerId, await getCrmAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-deleted');
}

export async function createAdminInvoice(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');

  if (!hasDatabaseUrl() || !requestId) {
    return workflowResult('invoice-error', false, false);
  }

  const result = await createInvoiceFromApprovedSelection({
    requestId,
    createdById: session.user.id,
    createdByRole: getCrmRole(session),
    requestContext: await getServerAuditRequestContext()
  });

  if (!result.ok) {
    return workflowResult(result.status, false);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  return workflowResult('invoice-created', true);
}

export async function sendAdminInvoice(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const invoiceId = readString(formData, 'invoiceId');

  if (!hasDatabaseUrl() || !requestId || !invoiceId) {
    return workflowResult('invoice-send-error', false, false);
  }

  let result: Awaited<ReturnType<typeof sendInvoiceToClient>>;
  try {
    result = await sendInvoiceToClient({
      invoiceId,
      expectedRequestId: requestId,
      audit: await getInvoiceAuditContext(session)
    });
  } catch {
    return workflowResult('invoice-send-error', false);
  }

  if (!result.ok) {
    return workflowResult(result.status, false);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  if (result.outcome === 'noop') {
    return workflowResult('invoice-already-sent', true);
  }
  if (!result.notificationDelivered) {
    return workflowResult('invoice-sent-notification-failed', true);
  }
  return workflowResult('invoice-sent', true);
}

export async function cancelAdminInvoice(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const invoiceId = readString(formData, 'invoiceId');

  if (!hasDatabaseUrl() || !requestId || !invoiceId) {
    redirectBack(requestId, 'invoice-error');
  }

  const result = await cancelInvoice(invoiceId, await getInvoiceAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  redirectBack(requestId, 'invoice-cancelled');
}

export async function markAdminInvoicePaid(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const invoiceId = readString(formData, 'invoiceId');

  if (!hasDatabaseUrl() || !requestId || !invoiceId) {
    redirectBack(requestId, 'invoice-error');
  }

  const result = await markInvoicePaid(invoiceId, await getInvoiceAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  redirectBack(requestId, 'invoice-paid');
}
