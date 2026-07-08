import { clientAccessError, getClientApiSession } from '@/lib/client/access';
import { createChangeRequest, listChangeRequestsForClient } from '@/lib/change-requests/service';
import { parseChangeRequestInput } from '@/lib/change-requests/validation';

export const runtime = 'nodejs';

export async function GET() {
  const access = await getClientApiSession();

  if (!access.ok) {
    return clientAccessError(access);
  }

  const items = await listChangeRequestsForClient(access.access);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const access = await getClientApiSession();

  if (!access.ok) {
    return clientAccessError(access);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseChangeRequestInput(body);

  if (!parsed.ok) {
    return Response.json({ status: parsed.status }, { status: 400 });
  }

  const result = await createChangeRequest(access.access, parsed.data);

  if (!result.ok) {
    return Response.json({ status: result.status }, { status: 403 });
  }

  return Response.json({ changeRequest: result.changeRequest }, { status: 201 });
}
