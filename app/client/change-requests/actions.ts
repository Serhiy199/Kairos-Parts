'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requireClientSession } from '@/lib/client/access';
import { cancelOwnPendingChangeRequest, createChangeRequest } from '@/lib/change-requests/service';
import { parseChangeRequestInput } from '@/lib/change-requests/validation';
import { hasDatabaseUrl } from '@/lib/env/database';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(result: string, fallback = '/client/change-requests'): never {
  const target = fallback.startsWith('/client') ? fallback : '/client/change-requests';
  const separator = target.includes('?') ? '&' : '?';
  redirect(`${target}${separator}result=${result}`);
}

function normalizeContextualPayload(formData: FormData) {
  const newValueText = readString(formData, 'newValueText');
  const currentValueText = readString(formData, 'currentValueText');

  if (newValueText && !readString(formData, 'newValue')) {
    formData.set('newValue', JSON.stringify({ text: newValueText }));
  }

  if (currentValueText && !readString(formData, 'oldValue')) {
    formData.set('oldValue', JSON.stringify({ text: currentValueText }));
  }
}

export async function createClientChangeRequestAction(formData: FormData) {
  const session = await requireClientSession();
  const redirectTo = readString(formData, 'redirectTo') || '/client/change-requests';
  normalizeContextualPayload(formData);

  if (!hasDatabaseUrl()) {
    redirectBack('database', redirectTo);
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const parsed = parseChangeRequestInput(formData);

  if (!parsed.ok) {
    redirectBack(parsed.status, redirectTo);
  }

  const result = await createChangeRequest(access, parsed.data);

  if (!result.ok) {
    redirectBack(result.status, redirectTo);
  }

  revalidatePath('/client/change-requests');
  revalidatePath(redirectTo);
  redirectBack('created', redirectTo);
}

export async function cancelClientChangeRequestAction(formData: FormData) {
  const session = await requireClientSession();
  const changeRequestId = readString(formData, 'changeRequestId');

  if (!hasDatabaseUrl() || !changeRequestId) {
    redirectBack('cancel-error');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const result = await cancelOwnPendingChangeRequest(access, changeRequestId);

  if (!result.ok) {
    redirectBack(result.status);
  }

  revalidatePath('/client/change-requests');
  redirectBack('cancelled');
}
