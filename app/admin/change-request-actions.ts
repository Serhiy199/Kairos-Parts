'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireCrmSession } from '@/lib/admin/access';
import { approveChangeRequest, rejectChangeRequest } from '@/lib/change-requests/service';
import { parseAdminReviewInput } from '@/lib/change-requests/validation';
import { hasDatabaseUrl } from '@/lib/env/database';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(result: string): never {
  redirect(`/admin/change-requests?result=${result}`);
}

export async function approveChangeRequestAction(formData: FormData) {
  const session = await requireCrmSession();
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
  redirectBack('approved');
}

export async function rejectChangeRequestAction(formData: FormData) {
  const session = await requireCrmSession();
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
