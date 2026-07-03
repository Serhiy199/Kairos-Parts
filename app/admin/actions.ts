'use server';

import { RequestStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { notifyRequestStatusChange } from '@/lib/notifications/status-change';
import { runOcrForRequestFile, updateOcrCorrection } from '@/lib/ocr/service';
import { prisma } from '@/lib/prisma';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string) {
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
