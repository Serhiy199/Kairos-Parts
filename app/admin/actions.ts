'use server';

import { RequestStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { saveRequestDocumentLocal } from '@/lib/files/local-storage';
import { notifyRequestStatusChange } from '@/lib/notifications/status-change';
import { runOcrForRequestFile, updateOcrCorrection } from '@/lib/ocr/service';
import { prisma } from '@/lib/prisma';
import { parseRequestDocumentMetadata, readRequiredRequestDocumentFile } from '@/lib/request-documents/validation';
import { parseRequestItemInput } from '@/lib/request-items/validation';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string): never {
  redirect(`/admin/requests/${requestId}?result=${result}`);
}

export async function updateAdminRequestStatus(formData: FormData) {
  const session = await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const status = readString(formData, 'status');

  if (!hasDatabaseUrl() || !requestId || !Object.values(RequestStatus).includes(status as RequestStatus)) {
    redirectBack(requestId, 'status-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, publicStatusToken: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  const nextStatus = status as RequestStatus;

  await prisma.$transaction([
    prisma.request.update({
      where: { id: request.id },
      data: { status: nextStatus }
    }),
    prisma.requestStatusHistory.create({
      data: {
        requestId: request.id,
        oldStatus: request.status,
        newStatus: nextStatus,
        changedByUserId: session.user.id
      }
    })
  ]);

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

  const manager = assignedManagerId
    ? await prisma.user.findFirst({
        where: { id: assignedManagerId, role: { in: ['MANAGER', 'ADMIN'] } },
        select: { id: true }
      })
    : null;

  if (assignedManagerId && !manager) {
    redirectBack(requestId, 'manager-not-found');
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { assignedManagerId: manager?.id ?? null }
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
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const parsed = parseRequestItemInput(formData);

  if (!hasDatabaseUrl() || !requestId || !parsed.ok) {
    redirectBack(requestId, 'item-error');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, vehicleId: true, clientId: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  await prisma.requestItem.create({
    data: {
      requestId: request.id,
      vehicleId: request.vehicleId,
      ...parsed.data
    }
  });

  revalidatePath(`/admin/requests/${request.id}`);

  if (request.vehicleId) {
    revalidatePath(`/client/vehicles/${request.vehicleId}`);
  }

  redirectBack(request.id, 'item-created');
}

export async function updateAdminRequestItem(formData: FormData) {
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');
  const parsed = parseRequestItemInput(formData);

  if (!hasDatabaseUrl() || !requestId || !itemId || !parsed.ok) {
    redirectBack(requestId, 'item-error');
  }

  const item = await prisma.requestItem.findFirst({
    where: { id: itemId, requestId },
    select: { id: true, requestId: true, vehicleId: true }
  });

  if (!item) {
    redirectBack(requestId, 'item-not-found');
  }

  await prisma.requestItem.update({
    where: { id: item.id },
    data: parsed.data
  });

  revalidatePath(`/admin/requests/${item.requestId}`);

  if (item.vehicleId) {
    revalidatePath(`/client/vehicles/${item.vehicleId}`);
  }

  redirectBack(item.requestId, 'item-updated');
}

export async function deleteAdminRequestItem(formData: FormData) {
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const itemId = readString(formData, 'itemId');

  if (!hasDatabaseUrl() || !requestId || !itemId) {
    redirectBack(requestId, 'item-error');
  }

  const item = await prisma.requestItem.findFirst({
    where: { id: itemId, requestId },
    select: { id: true, requestId: true, vehicleId: true }
  });

  if (!item) {
    redirectBack(requestId, 'item-not-found');
  }

  await prisma.requestItem.delete({
    where: { id: item.id }
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
    select: { id: true }
  });

  if (!request) {
    redirect('/admin/requests?result=request-not-found');
  }

  const savedFile = await saveRequestDocumentLocal(request.id, fileResult.file);

  await prisma.requestDocument.create({
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

  revalidatePath(`/admin/requests/${request.id}`);
  revalidatePath(`/client/requests/${request.id}`);
  redirectBack(request.id, 'document-created');
}

export async function updateAdminRequestDocument(formData: FormData) {
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const documentId = readString(formData, 'documentId');
  const metadata = parseRequestDocumentMetadata(formData);

  if (!hasDatabaseUrl() || !requestId || !documentId || !metadata.ok) {
    redirectBack(requestId, 'document-error');
  }

  const document = await prisma.requestDocument.findFirst({
    where: { id: documentId, requestId },
    select: { id: true, requestId: true }
  });

  if (!document) {
    redirectBack(requestId, 'document-not-found');
  }

  await prisma.requestDocument.update({
    where: { id: document.id },
    data: metadata.data
  });

  revalidatePath(`/admin/requests/${document.requestId}`);
  revalidatePath(`/client/requests/${document.requestId}`);
  redirectBack(document.requestId, 'document-updated');
}

export async function deleteAdminRequestDocument(formData: FormData) {
  await requireCrmSession();
  const requestId = readString(formData, 'requestId');
  const documentId = readString(formData, 'documentId');

  if (!hasDatabaseUrl() || !requestId || !documentId) {
    redirectBack(requestId, 'document-error');
  }

  const document = await prisma.requestDocument.findFirst({
    where: { id: documentId, requestId },
    select: { id: true, requestId: true }
  });

  if (!document) {
    redirectBack(requestId, 'document-not-found');
  }

  await prisma.requestDocument.delete({
    where: { id: document.id }
  });

  revalidatePath(`/admin/requests/${document.requestId}`);
  revalidatePath(`/client/requests/${document.requestId}`);
  redirectBack(document.requestId, 'document-deleted');
}
