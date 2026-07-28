import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { prisma } from '@/lib/prisma';
import {
  isManualRequestStatus,
  type ManualRequestStatus
} from '@/lib/requests/statuses';
import {
  REQUEST_STATUS_EVENTS,
  transitionRequestStatus
} from '@/lib/requests/status-transition';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const body = (await request.json()) as { intent?: string; status?: string };

  if (
    body.intent !== 'manual-status-change'
    || !body.status
    || !isManualRequestStatus(body.status)
    || (
      access.session.user.role !== 'ADMIN'
      && access.session.user.role !== 'MANAGER'
    )
  ) {
    return Response.json({ status: 'validation_error' }, { status: 400 });
  }

  const existingRequest = await prisma.request.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existingRequest) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const eventByStatus: Record<ManualRequestStatus, typeof REQUEST_STATUS_EVENTS[
    'MANUAL_SET_AWAITING_SHIPMENT'
    | 'MANUAL_SET_COMPLETED'
    | 'MANUAL_SET_CANCELLED'
  ]> = {
    AWAITING_SHIPMENT: REQUEST_STATUS_EVENTS.MANUAL_SET_AWAITING_SHIPMENT,
    COMPLETED: REQUEST_STATUS_EVENTS.MANUAL_SET_COMPLETED,
    CANCELLED: REQUEST_STATUS_EVENTS.MANUAL_SET_CANCELLED
  };
  const result = await transitionRequestStatus({
    requestId: id,
    event: eventByStatus[body.status],
    actor: { id: access.session.user.id },
    reason: 'Ручна зміна статусу через CRM API',
    metadata: { source: 'ADMIN_CRM' },
    requestContext: auditRequestContextFromHeaders(request.headers)
  });
  if (result.outcome === 'blocked') {
    return Response.json(
      { status: 'transition_blocked', reason: result.reason },
      { status: 409 }
    );
  }
  const updatedRequest = await prisma.request.findUnique({ where: { id } });

  return Response.json({ request: updatedRequest, transition: result });
}
