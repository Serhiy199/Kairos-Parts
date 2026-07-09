import { crmAccessError, getAdminApiSession } from '@/lib/admin/access';
import { listChangeRequestsForAdmin } from '@/lib/change-requests/service';

export const runtime = 'nodejs';

export async function GET() {
  const access = await getAdminApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const items = await listChangeRequestsForAdmin();
  return Response.json({ items });
}
