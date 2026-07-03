import { prisma } from '@/lib/prisma';
import { REQUEST_SOURCE_LABELS } from '@/lib/requests/sources';
import { REQUEST_STATUS_DESCRIPTIONS, REQUEST_STATUS_LABELS } from '@/lib/requests/statuses';

export const runtime = 'nodejs';

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!hasDatabaseUrl()) {
    return Response.json(
      {
        status: 'database_not_configured',
        message: 'DATABASE_URL is not configured. Public status lookup requires PostgreSQL.'
      },
      { status: 503 }
    );
  }

  const request = await prisma.request.findUnique({
    where: { publicStatusToken: token },
    select: {
      requestNumber: true,
      status: true,
      source: true,
      createdAt: true,
      updatedAt: true,
      description: true,
      equipmentType: true,
      companyName: true,
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        select: {
          oldStatus: true,
          newStatus: true,
          createdAt: true
        }
      }
    }
  });

  if (!request) {
    return Response.json({ status: 'not_found', message: 'Request status token was not found.' }, { status: 404 });
  }

  return Response.json({
    requestNumber: request.requestNumber,
    status: request.status,
    statusLabel: REQUEST_STATUS_LABELS[request.status],
    statusDescription: REQUEST_STATUS_DESCRIPTIONS[request.status],
    source: request.source,
    sourceLabel: REQUEST_SOURCE_LABELS[request.source],
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    description: request.description,
    equipmentType: request.equipmentType,
    companyName: request.companyName,
    timeline: request.statusHistory
  });
}
