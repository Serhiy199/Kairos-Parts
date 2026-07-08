'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientProfileForSession, requireClientSession } from '@/lib/client/access';
import { approveClientCommercialOffer, rejectClientCommercialOffer } from '@/lib/commercial-offers/service';
import { parseClientOfferComment } from '@/lib/commercial-offers/validation';
import { hasDatabaseUrl } from '@/lib/env/database';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string): never {
  redirect(`/client/requests/${requestId}?result=${result}`);
}

export async function approveClientCommercialOfferAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const offerId = readString(formData, 'offerId');

  if (!hasDatabaseUrl() || !requestId || !offerId) {
    redirectBack(requestId, 'offer-error');
  }

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    redirect('/login');
  }

  const result = await approveClientCommercialOffer(offerId, profile.id);

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

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    redirect('/login');
  }

  const result = await rejectClientCommercialOffer(offerId, profile.id, parseClientOfferComment(formData));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-rejected');
}
