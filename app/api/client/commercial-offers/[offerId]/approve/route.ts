import { clientAccessError, getClientApiSession } from '@/lib/client/access';
import { approveClientCommercialOffer } from '@/lib/commercial-offers/service';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getClientApiSession();

  if (!access.ok) {
    return clientAccessError(access);
  }

  const { offerId } = await params;
  const result = await approveClientCommercialOffer(offerId, access.access);

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: 400 });
  }

  return Response.json({ offer: result.offer });
}
