import { crmAccessError, getAdminApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json()) as { assignedManagerId?: string | null };
  const assignedManagerId = body.assignedManagerId?.trim() || null;

  const existingRequest = await prisma.request.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existingRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const manager = assignedManagerId
    ? await prisma.user.findFirst({
        where: { id: assignedManagerId, role: { in: ['MANAGER', 'ADMIN'] } },
        select: { id: true }
      })
    : null;

  if (assignedManagerId && !manager) {
    return Response.json({ status: 'manager_not_found' }, { status: 404 });
  }

  const updatedRequest = await prisma.request.update({
    where: { id },
    data: { assignedManagerId: manager?.id ?? null },
    include: { assignedManager: { select: { id: true, name: true, email: true, role: true } } }
  });

  return Response.json({ request: updatedRequest });
}
