import { getClientApiSession, vehicleAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function getClientAccess() {
  const result = await getClientApiSession();
  return result.ok ? { status: 'ok' as const, access: result.access } : result;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getClientAccess();
  const { id } = await params;

  if (result.status !== 'ok') {
    return Response.json({ status: result.status }, { status: result.statusCode });
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
    return Response.json({ status: result.status }, { status: result.statusCode });
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
