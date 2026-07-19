import { auth } from '@/auth';
import { documentAccessWhere, getClientAccessContext, requestAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ status: 'unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'CLIENT') {
    return Response.json({ status: 'forbidden' }, { status: 403 });
  }

  if (!hasDatabaseUrl()) {
    return Response.json({ status: 'database_not_configured' }, { status: 503 });
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return Response.json({ status: 'profile_not_found' }, { status: 404 });
  }

  const [documents, requestFiles] = await Promise.all([
    prisma.document.findMany({
      where: {
        AND: [
          documentAccessWhere(access),
          { OR: [{ vehicleId: null }, { visibleToClient: true }] }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        request: { select: { id: true, requestNumber: true } },
        vehicle: { select: { id: true, manufacturer: true, model: true } }
      }
    }),
    prisma.requestFile.findMany({
      where: { request: requestAccessWhere(access) },
      orderBy: { createdAt: 'desc' },
      include: { request: { select: { id: true, requestNumber: true } } }
    })
  ]);

  return Response.json({
    documents,
    requestFiles
  });
}
