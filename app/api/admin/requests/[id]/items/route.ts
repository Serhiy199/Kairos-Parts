import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import { parseRequestItemInput } from '@/lib/request-items/validation';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const items = await prisma.requestItem.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'desc' }
  });

  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseRequestItemInput(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const requestRecord = await prisma.request.findUnique({
    where: { id },
    select: { id: true, requestNumber: true, vehicleId: true, companyId: true }
  });

  if (!requestRecord) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const requestContext = auditRequestContextFromHeaders(request.headers);
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.requestItem.create({
      data: {
        requestId: requestRecord.id,
        vehicleId: requestRecord.vehicleId,
        ...parsed.data,
        visibleToClient: false
      }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: requestRecord.companyId,
      entityType: 'REQUEST_ITEM',
      entityId: created.id,
      entityLabel: created.catalogNumber ? `${created.name} · ${created.catalogNumber}` : created.name,
      action: 'REQUEST_ITEM_CREATED',
      category: created.salePrice !== null || created.quantity !== 1 ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      newValue: {
        name: created.name,
        brand: created.brand,
        catalogNumber: created.catalogNumber,
        analogNumber: created.analogNumber,
        quantity: created.quantity,
        availability: created.availability,
        salePrice: created.salePrice?.toString() ?? null,
        visibleToClient: created.visibleToClient,
        includeInInvoice: created.includeInInvoice
      },
      metadata: { source: 'ADMIN_CRM', requestNumber: requestRecord.requestNumber },
      allowedFields: {
        newValue: ['name', 'brand', 'catalogNumber', 'analogNumber', 'quantity', 'availability', 'salePrice', 'visibleToClient', 'includeInInvoice'],
        metadata: ['source', 'requestNumber']
      },
      requestContext
    });
    return created;
  });

  return Response.json({ item }, { status: 201 });
}
