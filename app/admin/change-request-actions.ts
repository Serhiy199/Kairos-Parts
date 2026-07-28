'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminSession } from '@/lib/admin/access';
import { approveChangeRequest, rejectChangeRequest } from '@/lib/change-requests/service';
import { parseAdminReviewInput } from '@/lib/change-requests/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(result: string): never {
  redirect(`/admin/change-requests?result=${result}`);
}

export async function approveChangeRequestAction(formData: FormData) {
  const session = await requireAdminSession();
  const changeRequestId = readString(formData, 'changeRequestId');

  if (!hasDatabaseUrl() || !changeRequestId) {
    redirectBack('review-error');
  }

  const input = parseAdminReviewInput(formData);
  const result = await approveChangeRequest(changeRequestId, session.user.id, input.adminComment);

  if (!result.ok) {
    redirectBack(result.status);
  }

  revalidatePath('/admin/change-requests');
  if (result.changeRequest.entityType === 'REQUEST_ITEM') {
    const requestItem = await prisma.requestItem.findUnique({
      where: { id: result.changeRequest.entityId },
      select: { requestId: true }
    });
    if (requestItem) {
      revalidatePath('/admin');
      revalidatePath('/admin/requests');
      revalidatePath(`/admin/requests/${requestItem.requestId}`);
    }
  }
  if (result.changeRequest.entityType === 'VEHICLE') {
    const affectedRequestItems = await prisma.requestItem.findMany({
      where: { vehicleId: result.changeRequest.entityId },
      select: { requestId: true },
      distinct: ['requestId']
    });
    revalidatePath('/admin');
    revalidatePath('/admin/requests');
    affectedRequestItems.forEach((item) => {
      revalidatePath(`/admin/requests/${item.requestId}`);
    });
    revalidatePath(`/admin/vehicles/${result.changeRequest.entityId}/edit`);
    revalidatePath('/client/vehicles');
    revalidatePath(`/client/vehicles/${result.changeRequest.entityId}`);
  }
  redirectBack('approved');
}

export async function rejectChangeRequestAction(formData: FormData) {
  const session = await requireAdminSession();
  const changeRequestId = readString(formData, 'changeRequestId');

  if (!hasDatabaseUrl() || !changeRequestId) {
    redirectBack('review-error');
  }

  const input = parseAdminReviewInput(formData);
  const result = await rejectChangeRequest(changeRequestId, session.user.id, input.adminComment);

  if (!result.ok) {
    redirectBack(result.status);
  }

  revalidatePath('/admin/change-requests');
  redirectBack('rejected');
}
