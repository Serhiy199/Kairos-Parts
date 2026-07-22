import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import { parseRequestItemInput } from '@/lib/request-items/validation';

export const runtime = 'nodejs';

const ITEM_FIELDS = [
  'name', 'brand', 'catalogNumber', 'analogNumber', 'quantity', 'availability',
  'salePrice', 'visibleToClient', 'includeInInvoice'
] as const;

function itemSnapshot(item: {
  name: string; brand: string | null; catalogNumber: string | null; analogNumber: string | null;
  quantity: number; availability: string | null; salePrice: { toString(): string } | null;
  visibleToClient: boolean; includeInInvoice: boolean;
}) {
  return {
    name: item.name,
    brand: item.brand,
    catalogNumber: item.catalogNumber,
    analogNumber: item.analogNumber,
    quantity: item.quantity,
    availability: item.availability,
    salePrice: item.salePrice?.toString() ?? null,
    visibleToClient: item.visibleToClient,
    includeInInvoice: item.includeInInvoice
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { itemId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseRequestItemInput(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const existing = await prisma.requestItem.findUnique({
    where: { id: itemId },
    include: { request: { select: { requestNumber: true, companyId: true } } }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const {
    purchasePrice: _purchasePrice,
    supplierName: _supplierName,
    visibleToClient: _visibleToClient,
    ...itemData
  } = parsed.data;
  void _purchasePrice;
  void _supplierName;
  void _visibleToClient;

  const requestContext = auditRequestContextFromHeaders(request.headers);
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.requestItem.update({ where: { id: itemId }, data: itemData });
    const before = itemSnapshot(existing);
    const after = itemSnapshot(updated);
    const diff = buildAuditDiff(before, after, ITEM_FIELDS);
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: existing.request.companyId,
      entityType: 'REQUEST_ITEM',
      entityId: existing.id,
      entityLabel: updated.catalogNumber ? `${updated.name} · ${updated.catalogNumber}` : updated.name,
      action: 'REQUEST_ITEM_UPDATED',
      category: before.salePrice !== after.salePrice || before.quantity !== after.quantity ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM', requestNumber: existing.request.requestNumber },
      allowedFields: { oldValue: ITEM_FIELDS, newValue: ITEM_FIELDS, metadata: ['source', 'requestNumber'] },
      requestContext
    });
    return updated;
  });

  return Response.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { itemId } = await params;
  const existing = await prisma.requestItem.findUnique({
    where: { id: itemId },
    include: { request: { select: { requestNumber: true, companyId: true } } }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const snapshot = itemSnapshot(existing);
  const requestContext = auditRequestContextFromHeaders(request.headers);
  await prisma.$transaction(async (tx) => {
    await tx.requestItem.delete({ where: { id: itemId } });
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: existing.request.companyId,
      entityType: 'REQUEST_ITEM',
      entityId: existing.id,
      entityLabel: existing.catalogNumber ? `${existing.name} · ${existing.catalogNumber}` : existing.name,
      action: 'REQUEST_ITEM_DELETED',
      category: snapshot.salePrice !== null || snapshot.quantity !== 1 ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      oldValue: snapshot,
      metadata: { source: 'ADMIN_CRM', requestNumber: existing.request.requestNumber },
      allowedFields: { oldValue: ITEM_FIELDS, metadata: ['source', 'requestNumber'] },
      requestContext
    });
  });

  return Response.json({ status: 'deleted' });
}
