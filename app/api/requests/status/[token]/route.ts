import { prisma } from '@/lib/prisma';

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
      createdAt: true,
      updatedAt: true,
      description: true
    }
  });

  if (!request) {
    return Response.json({ status: 'not_found', message: 'Request status token was not found.' }, { status: 404 });
  }

  return Response.json({
    requestNumber: request.requestNumber,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    description: request.description
  });
}
