import { auth } from '@/auth';
import { getClientAccessContext, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function getClientAccess() {
  const session = await auth();

  if (!session?.user?.id) return { status: 'unauthorized' as const };
  if (session.user.role !== 'CLIENT') return { status: 'forbidden' as const };
  if (!hasDatabaseUrl()) return { status: 'database_not_configured' as const };

  const access = await getClientAccessContext(session.user.id);
  return access ? { status: 'ok' as const, access } : { status: 'profile_not_found' as const };
}

function clientAccessStatusCode(status: Exclude<Awaited<ReturnType<typeof getClientAccess>>['status'], 'ok'>) {
  if (status === 'unauthorized') return 401;
  if (status === 'forbidden') return 403;
  if (status === 'profile_not_found') return 404;
  return 503;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClientAccess();
  const { id } = await params;

  if (result.status !== 'ok') {
    return Response.json({ status: result.status }, { status: clientAccessStatusCode(result.status) });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, AND: [vehicleAccessWhere(result.access)] },
    include: {
      requests: { select: { id: true, requestNumber: true, status: true, createdAt: true } },
      documents: true
    }
  });

  if (!vehicle) return Response.json({ status: 'not_found' }, { status: 404 });
  return Response.json({ vehicle });
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClientAccess();
  const { id } = await params;

  if (result.status !== 'ok') {
    return Response.json({ status: result.status }, { status: clientAccessStatusCode(result.status) });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, AND: [vehicleAccessWhere(result.access)] },
    select: { id: true }
  });

  if (!vehicle) return Response.json({ status: 'not_found' }, { status: 404 });

  return Response.json(
    {
      status: 'change_request_required',
      message: 'Зміни характеристик техніки потрібно надіслати менеджеру на погодження.',
      changeRequestEndpoint: '/api/client/change-requests'
    },
    { status: 409 }
  );
}
