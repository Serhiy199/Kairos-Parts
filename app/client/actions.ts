'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { createChangeRequest } from '@/lib/change-requests/service';
import { approveClientCommercialOffer, rejectClientCommercialOffer } from '@/lib/commercial-offers/service';
import { parseClientOfferComment } from '@/lib/commercial-offers/validation';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(requestId: string, result: string): never {
  redirect(`/client/requests/${requestId}?result=${result}`);
}

const CLIENT_REQUEST_ITEM_EDIT_FIELDS = new Set(['name', 'catalogNumber', 'analogNumber', 'quantity', 'comment']);

function readItemIds(formData: FormData) {
  return formData
    .getAll('itemIds')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

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

  const result = await approveClientCommercialOffer(offerId, access);

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

  const result = await rejectClientCommercialOffer(offerId, access, parseClientOfferComment(formData));

  if (!result.ok) {
    redirectBack(requestId, result.status);
  }

  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  redirectBack(requestId, 'offer-rejected');
}

export async function approveClientRequestItemsAction(formData: FormData) {
  const session = await requireClientSession();
  const requestId = readString(formData, 'requestId');
  const selectedItemIds = readItemIds(formData);

  if (!hasDatabaseUrl() || !requestId) {
    redirectBack(requestId, 'items-approval-error');
  }

  if (selectedItemIds.length === 0) {
    redirectBack(requestId, 'item-selection-required');
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    redirect('/login');
  }

  const request = await prisma.request.findFirst({
    where: { id: requestId, AND: [requestAccessWhere(access)] },
    select: {
      id: true,
      items: {
        where: { visibleToClient: true },
        select: { id: true }
      }
    }
  });

  if (!request) {
    redirectBack(requestId, 'items-approval-forbidden');
  }

  const visibleItemIds = new Set(request.items.map((item) => item.id));
  const selectedVisibleIds = selectedItemIds.filter((itemId) => visibleItemIds.has(itemId));

  if (selectedVisibleIds.length !== selectedItemIds.length) {
    redirectBack(requestId, 'items-approval-forbidden');
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.requestItem.updateMany({
      where: { requestId: request.id, visibleToClient: true, id: { in: selectedVisibleIds } },
      data: { includeInInvoice: true, approvedByClient: true, approvedAt: now }
    }),
    prisma.requestItem.updateMany({
      where: { requestId: request.id, visibleToClient: true, id: { notIn: selectedVisibleIds } },
      data: { includeInInvoice: false, approvedByClient: false, approvedAt: null }
    })
  ]);

  revalidatePath(`/client/requests/${request.id}`);
  revalidatePath('/client');
  revalidatePath('/client/requests');
  revalidatePath(`/admin/requests/${request.id}`);
  redirectBack(request.id, 'items-approved');
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
      analogNumber: true,
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
