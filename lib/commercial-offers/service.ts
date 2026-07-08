import { CommercialOfferStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const editableStatuses: CommercialOfferStatus[] = ['DRAFT'];

function toDecimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function calculateLineTotal(quantity: number, price: Prisma.Decimal.Value) {
  return toDecimal(price).mul(quantity);
}

export function canEditOffer(status: CommercialOfferStatus) {
  return editableStatuses.includes(status);
}

export async function generateCommercialOfferNumber(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { requestNumber: true }
  });

  if (!request) {
    throw new Error('request_not_found');
  }

  const count = await prisma.commercialOffer.count({
    where: { requestId }
  });

  return `${request.requestNumber}-CP-${String(count + 1).padStart(2, '0')}`;
}

export async function recalculateCommercialOfferTotals(offerId: string) {
  const items = await prisma.commercialOfferItem.findMany({
    where: { offerId },
    select: { total: true }
  });

  const subtotal = items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));

  return prisma.commercialOffer.update({
    where: { id: offerId },
    data: {
      subtotal,
      totalAmount: subtotal
    },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });
}

export async function createCommercialOfferFromRequest(requestId: string, createdById: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      items: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!request) {
    return { ok: false as const, status: 'request-not-found' };
  }

  if (request.items.length === 0) {
    return { ok: false as const, status: 'offer-no-items' };
  }

  const offerNumber = await generateCommercialOfferNumber(request.id);
  const createItems = request.items.map((item) => {
    const price = item.salePrice ?? new Prisma.Decimal(0);
    const total = calculateLineTotal(item.quantity, price);

    return {
      requestItemId: item.id,
      name: item.name,
      brand: item.brand,
      catalogNumber: item.catalogNumber,
      analogNumber: item.analogNumber,
      quantity: item.quantity,
      unit: item.unit,
      price,
      total,
      availability: item.availability,
      deliveryTime: item.deliveryTime,
      comment: item.comment
    };
  });
  const subtotal = createItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));

  const offer = await prisma.commercialOffer.create({
    data: {
      requestId: request.id,
      offerNumber,
      createdById,
      currency: 'UAH',
      subtotal,
      totalAmount: subtotal,
      items: { create: createItems }
    },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });

  return { ok: true as const, offer };
}

export async function updateCommercialOfferMetadata(
  offerId: string,
  data: { currency: string; validUntil: Date | null; managerComment: string | null }
) {
  const offer = await prisma.commercialOffer.findUnique({
    where: { id: offerId },
    select: { id: true, status: true }
  });

  if (!offer) {
    return { ok: false as const, status: 'offer-not-found' };
  }

  if (!canEditOffer(offer.status)) {
    return { ok: false as const, status: 'offer-not-editable' };
  }

  const updated = await prisma.commercialOffer.update({
    where: { id: offer.id },
    data
  });

  return { ok: true as const, offer: updated };
}

export async function updateCommercialOfferItem(
  offerId: string,
  itemId: string,
  data: { quantity: number; price: string; availability: string | null; deliveryTime: string | null; comment: string | null }
) {
  const item = await prisma.commercialOfferItem.findFirst({
    where: { id: itemId, offerId },
    select: { id: true, offer: { select: { id: true, status: true } } }
  });

  if (!item) {
    return { ok: false as const, status: 'offer-item-not-found' };
  }

  if (!canEditOffer(item.offer.status)) {
    return { ok: false as const, status: 'offer-not-editable' };
  }

  await prisma.commercialOfferItem.update({
    where: { id: item.id },
    data: {
      ...data,
      total: calculateLineTotal(data.quantity, data.price)
    }
  });

  const offer = await recalculateCommercialOfferTotals(offerId);
  return { ok: true as const, offer };
}

export async function sendCommercialOffer(offerId: string) {
  const offer = await prisma.commercialOffer.findUnique({
    where: { id: offerId },
    include: { items: { select: { id: true } } }
  });

  if (!offer) {
    return { ok: false as const, status: 'offer-not-found' };
  }

  if (offer.status !== 'DRAFT') {
    return { ok: false as const, status: 'offer-invalid-transition' };
  }

  if (offer.items.length === 0) {
    return { ok: false as const, status: 'offer-empty' };
  }

  const updated = await prisma.commercialOffer.update({
    where: { id: offer.id },
    data: {
      status: 'SENT',
      sentAt: new Date()
    }
  });

  return { ok: true as const, offer: updated };
}

export async function cancelCommercialOffer(offerId: string) {
  const offer = await prisma.commercialOffer.findUnique({
    where: { id: offerId },
    select: { id: true, status: true }
  });

  if (!offer) {
    return { ok: false as const, status: 'offer-not-found' };
  }

  if (!['DRAFT', 'SENT'].includes(offer.status)) {
    return { ok: false as const, status: 'offer-invalid-transition' };
  }

  const updated = await prisma.commercialOffer.update({
    where: { id: offer.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date()
    }
  });

  return { ok: true as const, offer: updated };
}

export async function deleteDraftCommercialOffer(offerId: string) {
  const offer = await prisma.commercialOffer.findUnique({
    where: { id: offerId },
    select: { id: true, status: true }
  });

  if (!offer) {
    return { ok: false as const, status: 'offer-not-found' };
  }

  if (offer.status !== 'DRAFT') {
    return { ok: false as const, status: 'offer-delete-draft-only' };
  }

  await prisma.commercialOffer.delete({ where: { id: offer.id } });
  return { ok: true as const };
}

export async function approveClientCommercialOffer(offerId: string, clientProfileId: string) {
  const offer = await prisma.commercialOffer.findFirst({
    where: {
      id: offerId,
      status: 'SENT',
      request: { clientId: clientProfileId }
    },
    select: { id: true }
  });

  if (!offer) {
    return { ok: false as const, status: 'offer-not-found-or-not-sent' };
  }

  const updated = await prisma.commercialOffer.update({
    where: { id: offer.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      clientComment: null
    }
  });

  return { ok: true as const, offer: updated };
}

export async function rejectClientCommercialOffer(offerId: string, clientProfileId: string, clientComment: string | null) {
  const offer = await prisma.commercialOffer.findFirst({
    where: {
      id: offerId,
      status: 'SENT',
      request: { clientId: clientProfileId }
    },
    select: { id: true }
  });

  if (!offer) {
    return { ok: false as const, status: 'offer-not-found-or-not-sent' };
  }

  const updated = await prisma.commercialOffer.update({
    where: { id: offer.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      clientComment
    }
  });

  return { ok: true as const, offer: updated };
}
