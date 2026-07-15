import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';
import { parseRequestItemInput } from '@/lib/request-items/validation';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const items = await prisma.requestItem.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'desc' }
  });

  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseRequestItemInput(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const requestRecord = await prisma.request.findUnique({
    where: { id },
    select: { id: true, vehicleId: true }
  });

  if (!requestRecord) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const item = await prisma.requestItem.create({
    data: {
      requestId: requestRecord.id,
      vehicleId: requestRecord.vehicleId,
      ...parsed.data,
      visibleToClient: false
    }
  });

  return Response.json({ item }, { status: 201 });
}
