import { clientAccessError, getClientApiSession, requestAccessWhere } from '@/lib/client/access';
import { CLIENT_VISIBLE_OFFER_STATUSES } from '@/lib/commercial-offers/validation';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getClientApiSession();

  if (!access.ok) {
    return clientAccessError(access);
  }

  const { offerId } = await params;
  const offer = await prisma.commercialOffer.findFirst({
    where: {
      id: offerId,
      status: { in: CLIENT_VISIBLE_OFFER_STATUSES },
      request: requestAccessWhere(access.access)
    },
    include: {
      request: { select: { id: true, requestNumber: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!offer) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  return Response.json({ offer });
}
