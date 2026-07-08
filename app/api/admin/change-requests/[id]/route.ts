import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { getChangeRequestForAdmin } from '@/lib/change-requests/service';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const changeRequest = await getChangeRequestForAdmin(id);

  if (!changeRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  return Response.json({ changeRequest });
}
