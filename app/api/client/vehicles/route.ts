import { auth } from '@/auth';
import { getClientAccessContext, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { vehicleOwnershipForClient } from '@/lib/vehicles/ownership';

export const runtime = 'nodejs';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getClientAccess() {
  const session = await auth();

  if (!session?.user?.id) {
    return { status: 'unauthorized' as const };
  }

  if (session.user.role !== 'CLIENT') {
    return { status: 'forbidden' as const };
  }

  if (!hasDatabaseUrl()) {
    return { status: 'database_not_configured' as const };
  }

  const access = await getClientAccessContext(session.user.id);
  return access ? { status: 'ok' as const, access } : { status: 'profile_not_found' as const };
}

export async function GET() {
  const result = await getClientAccess();

  if (result.status !== 'ok') {
    const statusCode = result.status === 'unauthorized' ? 401 : result.status === 'forbidden' ? 403 : result.status === 'profile_not_found' ? 404 : 503;
    return Response.json({ status: result.status }, { status: statusCode });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleAccessWhere(result.access),
    orderBy: { createdAt: 'desc' }
  });

  return Response.json({ items: vehicles });
}

export async function POST(request: Request) {
  const result = await getClientAccess();

  if (result.status !== 'ok') {
    const statusCode = result.status === 'unauthorized' ? 401 : result.status === 'forbidden' ? 403 : result.status === 'profile_not_found' ? 404 : 503;
    return Response.json({ status: result.status }, { status: statusCode });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const type = readString(body.type);
  const manufacturer = readString(body.manufacturer);
  const model = readString(body.model);
  const yearValue = typeof body.year === 'number' ? body.year : Number(readString(body.year));
  const year = Number.isInteger(yearValue) && yearValue > 1900 && yearValue < 2200 ? yearValue : null;

  if (!type || !manufacturer || !model) {
    return Response.json({ status: 'validation_error', errors: ['type, manufacturer and model are required.'] }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ...vehicleOwnershipForClient(result.access),
      type,
      manufacturer,
      model,
      year,
      vinOrSerial: readString(body.vinOrSerial) || null,
      comment: readString(body.comment) || null
    }
  });

  return Response.json({ vehicle }, { status: 201 });
}
