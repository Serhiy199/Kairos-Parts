import { RequestStatus } from '@prisma/client';

import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !Object.values(RequestStatus).includes(body.status as RequestStatus)) {
    return Response.json({ status: 'validation_error' }, { status: 400 });
  }

  const existingRequest = await prisma.request.findUnique({
    where: { id },
    select: { id: true, status: true }
  });

  if (!existingRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const nextStatus = body.status as RequestStatus;
  const [updatedRequest, historyItem] = await prisma.$transaction([
    prisma.request.update({
      where: { id },
      data: { status: nextStatus }
    }),
    prisma.requestStatusHistory.create({
      data: {
        requestId: id,
        oldStatus: existingRequest.status,
        newStatus: nextStatus,
        changedByUserId: access.session.user.id
      }
    })
  ]);

  return Response.json({ request: updatedRequest, historyItem });
}
