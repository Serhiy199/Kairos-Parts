import { crmAccessError, getAdminApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
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
    select: {
      id: true,
      requestNumber: true,
      companyId: true,
      assignedManager: { select: { id: true, name: true, email: true } }
    }
  });

  if (!existingRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const manager = assignedManagerId
    ? await prisma.user.findFirst({
        where: { id: assignedManagerId, role: { in: ['MANAGER', 'ADMIN'] } },
        select: { id: true, name: true, email: true }
      })
    : null;

  if (assignedManagerId && !manager) {
    return Response.json({ status: 'manager_not_found' }, { status: 404 });
  }

  const action = !existingRequest.assignedManager && manager
    ? 'REQUEST_MANAGER_ASSIGNED' as const
    : existingRequest.assignedManager && !manager
      ? 'REQUEST_MANAGER_UNASSIGNED' as const
      : 'REQUEST_MANAGER_REASSIGNED' as const;
  const requestContext = auditRequestContextFromHeaders(request.headers);
  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: { assignedManagerId: manager?.id ?? null },
      include: { assignedManager: { select: { id: true, name: true, email: true, role: true } } }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: existingRequest.companyId,
      entityType: 'REQUEST',
      entityId: existingRequest.id,
      entityLabel: `Заявка ${existingRequest.requestNumber}`,
      action,
      category: 'STANDARD',
      oldValue: existingRequest.assignedManager ? {
        managerId: existingRequest.assignedManager.id,
        managerName: existingRequest.assignedManager.name,
        managerEmail: existingRequest.assignedManager.email
      } : { managerId: null, managerName: null, managerEmail: null },
      newValue: manager ? {
        managerId: manager.id,
        managerName: manager.name,
        managerEmail: manager.email
      } : { managerId: null, managerName: null, managerEmail: null },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: {
        oldValue: ['managerId', 'managerName', 'managerEmail'],
        newValue: ['managerId', 'managerName', 'managerEmail'],
        metadata: ['source']
      },
      requestContext
    });
    return updated;
  });

  return Response.json({ request: updatedRequest });
}
