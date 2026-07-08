import { clientAccessError, getClientApiSession } from '@/lib/client/access';
import { cancelOwnPendingChangeRequest } from '@/lib/change-requests/service';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getClientApiSession();

  if (!access.ok) {
    return clientAccessError(access);
  }

  const { id } = await params;
  const result = await cancelOwnPendingChangeRequest(access.access, id);

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: 404 });
  }

  return Response.json({ changeRequest: result.changeRequest });
}
