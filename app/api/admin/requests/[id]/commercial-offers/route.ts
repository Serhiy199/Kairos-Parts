import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { createCommercialOfferFromRequest } from '@/lib/commercial-offers/service';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const offers = await prisma.commercialOffer.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });

  return Response.json({ offers });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const result = await createCommercialOfferFromRequest(id, {
    actorId: access.session.user.id,
    source: 'ADMIN_CRM',
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  if (!result.ok) {
    const statusCode = result.status === 'request-not-found' ? 404 : 400;
    return Response.json({ status: result.status }, { status: statusCode });
  }

  return Response.json({ offer: result.offer }, { status: 201 });
}
