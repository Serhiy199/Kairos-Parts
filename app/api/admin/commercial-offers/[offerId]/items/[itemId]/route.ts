import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { updateCommercialOfferItem } from '@/lib/commercial-offers/service';
import { parseCommercialOfferItemInput } from '@/lib/commercial-offers/validation';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ offerId: string; itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { offerId, itemId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseCommercialOfferItemInput(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const result = await updateCommercialOfferItem(offerId, itemId, parsed.data);

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: result.status === 'offer-item-not-found' ? 404 : 400 });
  }

  return Response.json({ offer: result.offer });
}
