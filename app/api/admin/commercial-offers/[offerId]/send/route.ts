import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { sendCommercialOffer } from '@/lib/commercial-offers/service';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { offerId } = await params;
  const result = await sendCommercialOffer(offerId, {
    actorId: access.session.user.id,
    source: 'ADMIN_CRM',
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: result.status === 'offer-not-found' ? 404 : 400 });
  }

  return Response.json({ offer: result.offer });
}
