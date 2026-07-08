import { clientAccessError, getClientApiSession } from '@/lib/client/access';
import { rejectClientCommercialOffer } from '@/lib/commercial-offers/service';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const access = await getClientApiSession();

  if (!access.ok) {
    return clientAccessError(access);
  }

  const { offerId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clientComment = typeof body.clientComment === 'string' && body.clientComment.trim() ? body.clientComment.trim() : null;
  const result = await rejectClientCommercialOffer(offerId, access.profile.id, clientComment);

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: 400 });
  }

  return Response.json({ offer: result.offer });
}
