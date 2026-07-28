import { revalidatePath } from 'next/cache';

import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import {
  RequestItemUpdateError,
  updateRequestItem
} from '@/lib/request-items/update';
import { parseRequestItemUpdateInput } from '@/lib/request-items/validation';

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

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string'
    ? body.expectedUpdatedAt.trim()
    : '';
  const parsed = parseRequestItemUpdateInput(body);

  if (!requestId || !expectedUpdatedAt || !parsed.ok) {
    return Response.json(
      {
        status: 'validation_error',
        message: parsed.ok ? 'Invalid request item update metadata.' : parsed.error
      },
      { status: 400 }
    );
  }

  const requestContext = auditRequestContextFromHeaders(request.headers);
  let result: Awaited<ReturnType<typeof updateRequestItem>>;
  try {
    result = await updateRequestItem({
      requestItemId: itemId,
      requestId,
      expectedUpdatedAt,
      actor: { id: access.session.user.id },
      values: parsed.data,
      requestContext
    });
  } catch (error) {
    const code = error instanceof RequestItemUpdateError
      ? error.code
      : 'REQUEST_ITEM_UPDATE_FAILED';
    console.error('Request item PATCH failed.', {
      requestId,
      requestItemId: itemId,
      expectedUpdatedAt,
      errorCode: code
    });
    if (code === 'REQUEST_ITEM_NOT_FOUND' || code === 'REQUEST_ITEM_NOT_IN_REQUEST') {
      return Response.json({ status: 'not_found' }, { status: 404 });
    }
    if (code === 'ACTOR_NOT_ALLOWED') {
      return Response.json({ status: 'forbidden' }, { status: 403 });
    }
    if (code === 'REQUEST_ITEM_VERSION_CONFLICT') {
      return Response.json({ status: 'version_conflict' }, { status: 409 });
    }
    if (code === 'REQUEST_ITEM_VALIDATION_FAILED') {
      return Response.json({ status: 'validation_error' }, { status: 400 });
    }
    return Response.json({ status: 'update_failed' }, { status: 500 });
  }

  if (result.outcome === 'no_changes') {
    return Response.json({
      status: 'no_changes',
      code: result.code,
      item: result.item,
      changedFields: []
    });
  }

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${result.item.requestId}`);

  return Response.json({
    status: 'updated',
    code: result.code,
    item: result.item,
    changedFields: result.changedFields
  });
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

  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${existing.requestId}`);

  return Response.json({ status: 'deleted' });
}
