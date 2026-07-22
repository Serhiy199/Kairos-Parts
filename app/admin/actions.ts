'use server';

import { RequestStatus, UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
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
  createInvoiceFromApprovedRequestItems,
  markInvoicePaid,
  sendInvoiceToClient
} from '@/lib/invoices/service';
import { notifyRequestStatusChange } from '@/lib/notifications/status-change';
import { runOcrForRequestFile, updateOcrCorrection } from '@/lib/ocr/service';
import { prisma } from '@/lib/prisma';
import { parseRequestDocumentMetadata, readRequiredRequestDocumentFile } from '@/lib/request-documents/validation';
import { parseRequestItemInput } from '@/lib/request-items/validation';
import { REQUEST_STATUSES } from '@/lib/requests/statuses';
import { sendTelegramRequestItemsApprovalNotification } from '@/lib/telegram/notifications';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string): never {
  redirect(`/admin/requests/${requestId}?result=${result}`);
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

const REQUEST_ITEM_AUDIT_FIELDS = [
  'name', 'brand', 'catalogNumber', 'analogNumber', 'quantity', 'availability',
  'salePrice', 'visibleToClient', 'includeInInvoice'
] as const;

const REQUEST_AUDIT_METADATA_FIELDS = ['source', 'itemCount', 'itemIds'] as const;
const REQUEST_DOCUMENT_AUDIT_FIELDS = [
  'documentId', 'fileName', 'documentType', 'title', 'visibility',
  'requestId', 'size', 'mimeType'
] as const;

function requestLabel(requestNumber: string) {
  return `Заявка ${requestNumber}`;
}

function requestItemLabel(name: string, catalogNumber: string | null) {
  return catalogNumber ? `${name} · ${catalogNumber}` : name;
}

function requestItemSnapshot(item: {
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  analogNumber: string | null;
  quantity: number;
  availability: string | null;
  salePrice: { toString(): string } | null;
  visibleToClient: boolean;
  includeInInvoice: boolean;
}) {
  return {
    name: item.name,
    brand: item.brand,
    catalogNumber: item.catalogNumber,
    analogNumber: item.analogNumber,
    quantity: item.quantity,
    availability: item.availability,
    salePrice: item.salePrice?.toString() ?? null,
    visibleToClient: item.visibleToClient,
    includeInInvoice: item.includeInInvoice
  };
}

function requestItemAuditCategory(snapshot: { salePrice: string | null; quantity: number }) {
  return snapshot.salePrice !== null || snapshot.quantity !== 1 ? 'FINANCIAL_CRITICAL' as const : 'STANDARD' as const;
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
  const status = readString(formData, 'status');

  if (!hasDatabaseUrl() || !requestId || !REQUEST_STATUSES.includes(status as (typeof REQUEST_STATUSES)[number])) {
    redirectBack(requestId, 'status-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requestNumber: true, status: true, publicStatusToken: true, companyId: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  const nextStatus = status as RequestStatus;
  const requestContext = await getServerAuditRequestContext();

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: request.id },
      data: { status: nextStatus }
    });
    await tx.requestStatusHistory.create({
      data: {
        requestId: request.id,
        oldStatus: request.status,
        newStatus: nextStatus,
        changedByUserId: session.user.id
      }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: request.companyId,
      entityType: 'REQUEST',
      entityId: request.id,
      entityLabel: requestLabel(request.requestNumber),
      action: 'REQUEST_STATUS_CHANGED',
      category: 'STANDARD',
      oldValue: { status: request.status },
      newValue: { status: nextStatus },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: ['status'], newValue: ['status'], metadata: ['source'] },
      requestContext
    });
  });

  try {
    await notifyRequestStatusChange(request.id, nextStatus);
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
    redirectBack(requestId, 'item-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requestNumber: true, vehicleId: true, clientId: true, companyId: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    const item = await tx.requestItem.create({
      data: {
        requestId: request.id,
        vehicleId: request.vehicleId,
        ...parsed.data,
        visibleToClient: false
      }
    });
    const snapshot = requestItemSnapshot(item);
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: request.companyId,
      entityType: 'REQUEST_ITEM',
      entityId: item.id,
      entityLabel: requestItemLabel(item.name, item.catalogNumber),
      action: 'REQUEST_ITEM_CREATED',
      category: requestItemAuditCategory(snapshot),
      newValue: snapshot,
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { newValue: REQUEST_ITEM_AUDIT_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath(`/admin/requests/${request.id}`);

  if (request.vehicleId) {
    revalidatePath(`/client/vehicles/${request.vehicleId}`);
  }

  redirectBack(request.id, 'item-created');
}

export async function updateAdminRequestItem(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');
  const parsed = parseRequestItemInput(formData);

  if (!hasDatabaseUrl() || !requestId || !itemId || !parsed.ok) {
    redirectBack(requestId, 'item-error');
  }

  const item = await prisma.requestItem.findFirst({
    where: { id: itemId, requestId },
    select: {
      id: true, requestId: true, vehicleId: true, name: true, brand: true,
      catalogNumber: true, analogNumber: true, quantity: true, availability: true,
      salePrice: true, visibleToClient: true, includeInInvoice: true,
      request: { select: { requestNumber: true, companyId: true } }
    }
  });

  if (!item) {
    redirectBack(requestId, 'item-not-found');
  }

  const {
    purchasePrice: _purchasePrice,
    supplierName: _supplierName,
    visibleToClient: _visibleToClient,
    ...itemData
  } = parsed.data;
  void _purchasePrice;
  void _supplierName;
  void _visibleToClient;

  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.requestItem.update({
      where: { id: item.id },
      data: itemData
    });
    const before = requestItemSnapshot(item);
    const after = requestItemSnapshot(updated);
    const diff = buildAuditDiff(before, after, REQUEST_ITEM_AUDIT_FIELDS);
    const category = before.salePrice !== after.salePrice || before.quantity !== after.quantity
      ? 'FINANCIAL_CRITICAL' as const
      : 'STANDARD' as const;
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: item.request.companyId,
      entityType: 'REQUEST_ITEM',
      entityId: item.id,
      entityLabel: requestItemLabel(updated.name, updated.catalogNumber),
      action: 'REQUEST_ITEM_UPDATED',
      category,
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: REQUEST_ITEM_AUDIT_FIELDS, newValue: REQUEST_ITEM_AUDIT_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath(`/admin/requests/${item.requestId}`);

  if (item.vehicleId) {
    revalidatePath(`/client/vehicles/${item.vehicleId}`);
  }

  redirectBack(item.requestId, 'item-updated');
}

export async function sendAdminRequestItemsForApproval(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');

  if (!hasDatabaseUrl() || !requestId) {
    redirectBack(requestId, 'items-send-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      companyId: true,
      items: { where: { visibleToClient: false }, select: { id: true } }
    }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  if (request.items.length === 0) {
    redirectBack(request.id, 'items-send-empty');
  }

  const itemIds = request.items.map((item) => item.id);
  const requestContext = await getServerAuditRequestContext();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.requestItem.updateMany({
      where: { requestId: request.id, visibleToClient: false, id: { in: itemIds } },
      data: { visibleToClient: true }
    });
    if (updated.count > 0) {
      await writeAuditLog(tx, {
        actor: auditUserActor(session.user.id),
        companyId: request.companyId,
        entityType: 'REQUEST',
        entityId: request.id,
        entityLabel: requestLabel(request.requestNumber),
        action: 'REQUEST_ITEMS_SENT_FOR_APPROVAL',
        category: 'STANDARD',
        metadata: { source: 'ADMIN_CRM', itemCount: updated.count, itemIds: itemIds.slice(0, 50) },
        allowedFields: { metadata: REQUEST_AUDIT_METADATA_FIELDS },
        requestContext
      });
    }
    return updated;
  });

  if (result.count === 0) {
    redirectBack(request.id, 'items-send-empty');
  }

  try {
    const notificationResult = await sendTelegramRequestItemsApprovalNotification({ requestId: request.id });

    if (notificationResult.status === 'failed') {
      console.warn(`Telegram items approval notification failed for request ${request.id}.`);
    }
  } catch {
    console.warn(`Telegram items approval notification could not be processed for request ${request.id}.`);
  }

  revalidatePath(`/admin/requests/${request.id}`);
  revalidatePath('/client');
  revalidatePath('/client/requests');
  revalidatePath(`/client/requests/${request.id}`);
  redirectBack(request.id, 'items-sent-for-approval');
}

export async function deleteAdminRequestItem(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');

  if (!hasDatabaseUrl() || !requestId || !itemId) {
    redirectBack(requestId, 'item-error');
  }

  const item = await prisma.requestItem.findFirst({
    where: { id: itemId, requestId },
    select: {
      id: true, requestId: true, vehicleId: true, name: true, brand: true,
      catalogNumber: true, analogNumber: true, quantity: true, availability: true,
      salePrice: true, visibleToClient: true, includeInInvoice: true,
      request: { select: { companyId: true } }
    }
  });

  if (!item) {
    redirectBack(requestId, 'item-not-found');
  }

  const snapshot = requestItemSnapshot(item);
  const requestContext = await getServerAuditRequestContext();
  await prisma.$transaction(async (tx) => {
    await tx.requestItem.delete({ where: { id: item.id } });
    await writeAuditLog(tx, {
      actor: auditUserActor(session.user.id),
      companyId: item.request.companyId,
      entityType: 'REQUEST_ITEM',
      entityId: item.id,
      entityLabel: requestItemLabel(item.name, item.catalogNumber),
      action: 'REQUEST_ITEM_DELETED',
      category: requestItemAuditCategory(snapshot),
      oldValue: snapshot,
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: REQUEST_ITEM_AUDIT_FIELDS, metadata: ['source'] },
      requestContext
    });
  });

  revalidatePath(`/admin/requests/${item.requestId}`);

  if (item.vehicleId) {
    revalidatePath(`/client/vehicles/${item.vehicleId}`);
  }

  redirectBack(item.requestId, 'item-deleted');
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
    redirectBack(requestId, 'invoice-error');
  }

  const result = await createInvoiceFromApprovedRequestItems({
    requestId,
    createdById: session.user.id,
    createdByRole: getCrmRole(session),
    requestContext: await getServerAuditRequestContext()
  });

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'invoice-created');
}

export async function sendAdminInvoice(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const invoiceId = readString(formData, 'invoiceId');

  if (!hasDatabaseUrl() || !requestId || !invoiceId) {
    redirectBack(requestId, 'invoice-error');
  }

  const result = await sendInvoiceToClient(invoiceId, await getInvoiceAuditContext(session));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  redirectBack(requestId, 'invoice-sent');
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
