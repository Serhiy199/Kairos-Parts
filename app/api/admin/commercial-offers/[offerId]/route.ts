import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import {
  cancelCommercialOffer,
  deleteDraftCommercialOffer,
  updateCommercialOfferMetadata
} from '@/lib/commercial-offers/service';
import { parseCommercialOfferMetadata } from '@/lib/commercial-offers/validation';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { offerId } = await params;
  const offer = await prisma.commercialOffer.findUnique({
    where: { id: offerId },
    include: {
      request: { select: { id: true, requestNumber: true, clientId: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!offer) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  return Response.json({ offer });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { offerId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseCommercialOfferMetadata(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const result = await updateCommercialOfferMetadata(offerId, parsed.data, {
    actorId: access.session.user.id,
    source: 'ADMIN_CRM',
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: result.status === 'offer-not-found' ? 404 : 400 });
  }

  return Response.json({ offer: result.offer });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { offerId } = await params;
  const result = await deleteDraftCommercialOffer(offerId, {
    actorId: access.session.user.id,
    source: 'ADMIN_CRM',
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: result.status === 'offer-not-found' ? 404 : 400 });
  }

  return Response.json({ status: 'deleted' });
}

export async function POST(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { offerId } = await params;
  const result = await cancelCommercialOffer(offerId, {
    actorId: access.session.user.id,
    source: 'ADMIN_CRM',
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: result.status === 'offer-not-found' ? 404 : 400 });
  }

  return Response.json({ offer: result.offer });
}
