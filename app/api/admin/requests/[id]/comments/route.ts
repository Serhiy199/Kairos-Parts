import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json()) as { message?: string };
  const message = body.message?.trim();

  if (!message) {
    return Response.json({ status: 'validation_error' }, { status: 400 });
  }

  const existingRequest = await prisma.request.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existingRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const comment = await prisma.requestComment.create({
    data: {
      requestId: id,
      authorId: access.session.user.id,
      message,
      internal: true
    },
    include: { author: { select: { id: true, name: true, email: true, role: true } } }
  });

  return Response.json({ comment }, { status: 201 });
}
