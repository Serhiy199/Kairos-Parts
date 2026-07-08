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

function redirectBack(result: string): never {
  redirect(`/client/change-requests?result=${result}`);
}

export async function createClientChangeRequestAction(formData: FormData) {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    redirectBack('database');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const parsed = parseChangeRequestInput(formData);

  if (!parsed.ok) {
    redirectBack(parsed.status);
  }

  const result = await createChangeRequest(access, parsed.data);

  if (!result.ok) {
    redirectBack(result.status);
  }

  revalidatePath('/client/change-requests');
  redirectBack('created');
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
