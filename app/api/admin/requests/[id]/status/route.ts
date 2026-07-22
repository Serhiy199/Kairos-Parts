import { RequestStatus } from '@prisma/client';

import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import { REQUEST_STATUSES } from '@/lib/requests/statuses';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !REQUEST_STATUSES.includes(body.status as (typeof REQUEST_STATUSES)[number])) {
    return Response.json({ status: 'validation_error' }, { status: 400 });
  }

  const existingRequest = await prisma.request.findUnique({
    where: { id },
    select: { id: true, requestNumber: true, status: true, companyId: true }
  });

  if (!existingRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const nextStatus = body.status as RequestStatus;
  const requestContext = auditRequestContextFromHeaders(request.headers);
  const { updatedRequest, historyItem } = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.request.update({
      where: { id },
      data: { status: nextStatus }
    });
    const historyItem = await tx.requestStatusHistory.create({
      data: {
        requestId: id,
        oldStatus: existingRequest.status,
        newStatus: nextStatus,
        changedByUserId: access.session.user.id
      }
    });
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: existingRequest.companyId,
      entityType: 'REQUEST',
      entityId: existingRequest.id,
      entityLabel: `Заявка ${existingRequest.requestNumber}`,
      action: 'REQUEST_STATUS_CHANGED',
      category: 'STANDARD',
      oldValue: { status: existingRequest.status },
      newValue: { status: nextStatus },
      metadata: { source: 'ADMIN_CRM' },
      allowedFields: { oldValue: ['status'], newValue: ['status'], metadata: ['source'] },
      requestContext
    });
    return { updatedRequest, historyItem };
  });

  return Response.json({ request: updatedRequest, historyItem });
}
