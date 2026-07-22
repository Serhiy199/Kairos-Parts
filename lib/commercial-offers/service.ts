import { CommercialOfferStatus, Prisma } from '@prisma/client';

import type { AuditRequestContext, AuditSource } from '@/lib/audit-log/contracts';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import type { ClientAccessContext } from '@/lib/client/access';
import { requestAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

const editableStatuses: CommercialOfferStatus[] = ['DRAFT'];
const OFFER_FIELDS = [
  'offerNumber', 'status', 'currency', 'subtotal', 'total', 'itemCount',
  'validUntil', 'sentAt', 'approvedAt', 'rejectedAt', 'cancelledAt'
] as const;
const OFFER_ITEM_CHANGE_FIELDS = [
  'offerNumber', 'currency', 'subtotal', 'total', 'itemCount',
  'quantity', 'price', 'lineTotal'
] as const;

export type CommercialOfferAuditContext = {
  actorId: string;
  source: AuditSource;
  requestContext?: AuditRequestContext;
};

const offerAuditSelect = {
  id: true,
  requestId: true,
  offerNumber: true,
  status: true,
  currency: true,
  subtotal: true,
  totalAmount: true,
  validUntil: true,
  sentAt: true,
  approvedAt: true,
  rejectedAt: true,
  cancelledAt: true,
  request: { select: { requestNumber: true, companyId: true } },
  _count: { select: { items: true } }
} satisfies Prisma.CommercialOfferSelect;

type OfferAuditRecord = Prisma.CommercialOfferGetPayload<{ select: typeof offerAuditSelect }>;
type AuditWriter = Prisma.TransactionClient | typeof prisma;

function toDecimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function calculateLineTotal(quantity: number, price: Prisma.Decimal.Value) {
  return toDecimal(price).mul(quantity);
}

function offerSnapshot(offer: OfferAuditRecord) {
  return {
    offerNumber: offer.offerNumber,
    status: offer.status,
    currency: offer.currency,
    subtotal: offer.subtotal.toString(),
    total: offer.totalAmount.toString(),
    itemCount: offer._count.items,
    validUntil: offer.validUntil,
    sentAt: offer.sentAt,
    approvedAt: offer.approvedAt,
    rejectedAt: offer.rejectedAt,
    cancelledAt: offer.cancelledAt
  };
}

function offerItemChangeSnapshot(
  offer: OfferAuditRecord,
  item: { quantity: number; price: Prisma.Decimal; total: Prisma.Decimal }
) {
  return {
    offerNumber: offer.offerNumber,
    currency: offer.currency,
    subtotal: offer.subtotal.toString(),
    total: offer.totalAmount.toString(),
    itemCount: offer._count.items,
    quantity: item.quantity,
    price: item.price.toString(),
    lineTotal: item.total.toString()
  };
}

async function writeOfferAudit(
  tx: Prisma.TransactionClient,
  audit: CommercialOfferAuditContext,
  offer: OfferAuditRecord,
  input: {
    action: Prisma.AuditLogCreateInput['action'];
    category: 'STANDARD' | 'FINANCIAL_CRITICAL';
    oldValue?: unknown;
    newValue?: unknown;
    valueFields?: readonly string[];
    metadata?: Record<string, unknown>;
    metadataFields?: readonly string[];
  }
) {
  await writeAuditLog(tx, {
    actor: auditUserActor(audit.actorId),
    companyId: offer.request.companyId,
    entityType: 'COMMERCIAL_OFFER',
    entityId: offer.id,
    entityLabel: `Комерційна пропозиція ${offer.offerNumber}`,
    action: input.action,
    category: input.category,
    oldValue: input.oldValue,
    newValue: input.newValue,
    metadata: { source: audit.source, requestId: offer.requestId, ...input.metadata },
    allowedFields: {
      oldValue: input.valueFields ?? OFFER_FIELDS,
      newValue: input.valueFields ?? OFFER_FIELDS,
      metadata: ['source', 'requestId', ...(input.metadataFields ?? [])]
    },
    requestContext: audit.requestContext
  });
}

export function canEditOffer(status: CommercialOfferStatus) {
  return editableStatuses.includes(status);
}

async function generateCommercialOfferNumberWithWriter(writer: AuditWriter, requestId: string) {
  const request = await writer.request.findUnique({
    where: { id: requestId },
    select: { requestNumber: true }
  });

  if (!request) {
    throw new Error('request_not_found');
  }

  const count = await writer.commercialOffer.count({ where: { requestId } });
  return `${request.requestNumber}-CP-${String(count + 1).padStart(2, '0')}`;
}

export async function generateCommercialOfferNumber(requestId: string) {
  return generateCommercialOfferNumberWithWriter(prisma, requestId);
}

async function recalculateCommercialOfferTotalsWithWriter(writer: AuditWriter, offerId: string) {
  const items = await writer.commercialOfferItem.findMany({
    where: { offerId },
    select: { total: true }
  });
  const subtotal = items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
  return writer.commercialOffer.update({
    where: { id: offerId },
    data: { subtotal, totalAmount: subtotal },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });
}

export async function recalculateCommercialOfferTotals(offerId: string) {
  return recalculateCommercialOfferTotalsWithWriter(prisma, offerId);
}

export async function createCommercialOfferFromRequest(
  requestId: string,
  audit: CommercialOfferAuditContext
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: { id: true, requestNumber: true, items: { orderBy: { createdAt: 'asc' } } }
    });
    if (!request) return { ok: false as const, status: 'request-not-found' };
    if (request.items.length === 0) return { ok: false as const, status: 'offer-no-items' };

    const offerNumber = await generateCommercialOfferNumberWithWriter(tx, request.id);
    const createItems = request.items.map((item) => {
      const price = item.salePrice ?? new Prisma.Decimal(0);
      return {
        requestItemId: item.id,
        name: item.name,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unit: item.unit,
        price,
        total: calculateLineTotal(item.quantity, price),
        availability: item.availability,
        comment: item.comment
      };
    });
    const subtotal = createItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
    const offer = await tx.commercialOffer.create({
      data: {
        requestId: request.id,
        offerNumber,
        createdById: audit.actorId,
        currency: 'UAH',
        subtotal,
        totalAmount: subtotal,
        items: { create: createItems }
      },
      include: { items: { orderBy: { createdAt: 'asc' } } }
    });
    const auditOffer = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offer.id }, select: offerAuditSelect });
    await writeOfferAudit(tx, audit, auditOffer, {
      action: 'COMMERCIAL_OFFER_CREATED',
      category: 'FINANCIAL_CRITICAL',
      newValue: offerSnapshot(auditOffer)
    });
    return { ok: true as const, offer };
  });
}

export async function updateCommercialOfferMetadata(
  offerId: string,
  data: { currency: string; validUntil: Date | null; managerComment: string | null },
  audit: CommercialOfferAuditContext
) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.commercialOffer.findUnique({ where: { id: offerId }, select: offerAuditSelect });
    if (!offer) return { ok: false as const, status: 'offer-not-found' };
    if (!canEditOffer(offer.status)) return { ok: false as const, status: 'offer-not-editable' };

    const updated = await tx.commercialOffer.update({ where: { id: offer.id }, data });
    const auditUpdated = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offer.id }, select: offerAuditSelect });
    const diff = buildAuditDiff(offerSnapshot(offer), offerSnapshot(auditUpdated), OFFER_FIELDS);
    await writeOfferAudit(tx, audit, auditUpdated, {
      action: 'COMMERCIAL_OFFER_UPDATED',
      category: offer.currency !== updated.currency ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, offer: updated };
  });
}

export async function updateCommercialOfferItem(
  offerId: string,
  itemId: string,
  data: { quantity: number; price: string; availability: string | null; comment: string | null },
  audit: CommercialOfferAuditContext
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.commercialOfferItem.findFirst({
      where: { id: itemId, offerId },
      select: {
        id: true, quantity: true, price: true, total: true,
        offer: { select: offerAuditSelect }
      }
    });
    if (!item) return { ok: false as const, status: 'offer-item-not-found' };
    if (!canEditOffer(item.offer.status)) return { ok: false as const, status: 'offer-not-editable' };

    const updatedItem = await tx.commercialOfferItem.update({
      where: { id: item.id },
      data: { ...data, total: calculateLineTotal(data.quantity, data.price) }
    });
    const updatedOffer = await recalculateCommercialOfferTotalsWithWriter(tx, offerId);
    const auditUpdatedOffer = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offerId }, select: offerAuditSelect });
    await writeOfferAudit(tx, audit, auditUpdatedOffer, {
      action: 'COMMERCIAL_OFFER_ITEMS_CHANGED',
      category: 'FINANCIAL_CRITICAL',
      oldValue: offerItemChangeSnapshot(item.offer, item),
      newValue: offerItemChangeSnapshot(auditUpdatedOffer, updatedItem),
      valueFields: OFFER_ITEM_CHANGE_FIELDS,
      metadata: { itemId },
      metadataFields: ['itemId']
    });
    return { ok: true as const, offer: updatedOffer };
  });
}

export async function sendCommercialOffer(offerId: string, audit: CommercialOfferAuditContext) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.commercialOffer.findUnique({ where: { id: offerId }, select: offerAuditSelect });
    if (!offer) return { ok: false as const, status: 'offer-not-found' };
    if (offer.status !== 'DRAFT') return { ok: false as const, status: 'offer-invalid-transition' };
    if (offer._count.items === 0) return { ok: false as const, status: 'offer-empty' };

    const updated = await tx.commercialOffer.update({
      where: { id: offer.id },
      data: { status: 'SENT', sentAt: new Date() }
    });
    const auditUpdated = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offer.id }, select: offerAuditSelect });
    const diff = buildAuditDiff(offerSnapshot(offer), offerSnapshot(auditUpdated), OFFER_FIELDS);
    await writeOfferAudit(tx, audit, auditUpdated, {
      action: 'COMMERCIAL_OFFER_SENT',
      category: 'STANDARD',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, offer: updated };
  });
}

export async function cancelCommercialOffer(offerId: string, audit: CommercialOfferAuditContext) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.commercialOffer.findUnique({ where: { id: offerId }, select: offerAuditSelect });
    if (!offer) return { ok: false as const, status: 'offer-not-found' };
    if (!['DRAFT', 'SENT'].includes(offer.status)) return { ok: false as const, status: 'offer-invalid-transition' };

    const updated = await tx.commercialOffer.update({
      where: { id: offer.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() }
    });
    const auditUpdated = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offer.id }, select: offerAuditSelect });
    const diff = buildAuditDiff(offerSnapshot(offer), offerSnapshot(auditUpdated), OFFER_FIELDS);
    await writeOfferAudit(tx, audit, auditUpdated, {
      action: 'COMMERCIAL_OFFER_CANCELLED',
      category: 'FINANCIAL_CRITICAL',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, offer: updated };
  });
}

export async function deleteDraftCommercialOffer(offerId: string, audit: CommercialOfferAuditContext) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.commercialOffer.findUnique({ where: { id: offerId }, select: offerAuditSelect });
    if (!offer) return { ok: false as const, status: 'offer-not-found' };
    if (offer.status !== 'DRAFT') return { ok: false as const, status: 'offer-delete-draft-only' };

    await writeOfferAudit(tx, audit, offer, {
      action: 'COMMERCIAL_OFFER_DELETED',
      category: 'FINANCIAL_CRITICAL',
      oldValue: offerSnapshot(offer)
    });
    await tx.commercialOffer.delete({ where: { id: offer.id } });
    return { ok: true as const };
  });
}

export async function approveClientCommercialOffer(
  offerId: string,
  access: ClientAccessContext,
  requestContext?: AuditRequestContext
) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.commercialOffer.findFirst({
      where: { id: offerId, status: 'SENT', request: requestAccessWhere(access) },
      select: offerAuditSelect
    });
    if (!offer) return { ok: false as const, status: 'offer-not-found-or-not-sent' };

    const updated = await tx.commercialOffer.update({
      where: { id: offer.id },
      data: { status: 'APPROVED', approvedAt: new Date(), clientComment: null }
    });
    const auditUpdated = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offer.id }, select: offerAuditSelect });
    const diff = buildAuditDiff(offerSnapshot(offer), offerSnapshot(auditUpdated), OFFER_FIELDS);
    await writeOfferAudit(tx, { actorId: access.userId, source: 'CLIENT_CABINET', requestContext }, auditUpdated, {
      action: 'COMMERCIAL_OFFER_APPROVED',
      category: 'FINANCIAL_CRITICAL',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, offer: updated };
  });
}

export async function rejectClientCommercialOffer(
  offerId: string,
  access: ClientAccessContext,
  clientComment: string | null,
  requestContext?: AuditRequestContext
) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.commercialOffer.findFirst({
      where: { id: offerId, status: 'SENT', request: requestAccessWhere(access) },
      select: offerAuditSelect
    });
    if (!offer) return { ok: false as const, status: 'offer-not-found-or-not-sent' };

    const updated = await tx.commercialOffer.update({
      where: { id: offer.id },
      data: { status: 'REJECTED', rejectedAt: new Date(), clientComment }
    });
    const auditUpdated = await tx.commercialOffer.findUniqueOrThrow({ where: { id: offer.id }, select: offerAuditSelect });
    const diff = buildAuditDiff(offerSnapshot(offer), offerSnapshot(auditUpdated), OFFER_FIELDS);
    await writeOfferAudit(tx, { actorId: access.userId, source: 'CLIENT_CABINET', requestContext }, auditUpdated, {
      action: 'COMMERCIAL_OFFER_REJECTED',
      category: 'STANDARD',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, offer: updated };
  });
}
