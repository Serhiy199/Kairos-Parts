import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { approveChangeRequest } from '@/lib/change-requests/service';
import { parseAdminReviewInput } from '@/lib/change-requests/validation';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const input = parseAdminReviewInput((await request.json().catch(() => ({}))) as Record<string, unknown>);
  const result = await approveChangeRequest(id, access.session.user.id, input.adminComment);

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: 400 });
  }

  return Response.json({ changeRequest: result.changeRequest });
}
