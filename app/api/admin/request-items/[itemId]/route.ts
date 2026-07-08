import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';
import { parseRequestItemInput } from '@/lib/request-items/validation';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { itemId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const parsed = parseRequestItemInput(body);

  if (!parsed.ok) {
    return Response.json({ status: 'validation_error', message: parsed.error }, { status: 400 });
  }

  const existing = await prisma.requestItem.findUnique({
    where: { id: itemId },
    select: { id: true }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const item = await prisma.requestItem.update({
    where: { id: itemId },
    data: parsed.data
  });

  return Response.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { itemId } = await params;
  const existing = await prisma.requestItem.findUnique({
    where: { id: itemId },
    select: { id: true }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  await prisma.requestItem.delete({
    where: { id: itemId }
  });

  return Response.json({ status: 'deleted' });
}
