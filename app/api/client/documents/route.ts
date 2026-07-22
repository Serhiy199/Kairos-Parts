import { documentAccessWhere, getClientApiSession, requestAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const authResult = await getClientApiSession();

  if (!authResult.ok) {
    return Response.json({ status: authResult.status }, { status: authResult.statusCode });
  }

  const access = authResult.access;

  const [documents, requestFiles] = await Promise.all([
    prisma.document.findMany({
      where: { AND: [documentAccessWhere(access), { visibleToClient: true }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        clientId: true,
        companyId: true,
        requestId: true,
        vehicleId: true,
        company: { select: { id: true, name: true } },
        request: { select: { id: true, requestNumber: true } },
        vehicle: { select: { id: true, name: true, manufacturer: true, model: true } }
      }
    }),
    prisma.requestFile.findMany({
      where: { request: requestAccessWhere(access) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        request: { select: { id: true, requestNumber: true } }
      }
    })
  ]);

  return Response.json({
    documents: documents.map((document) => ({
      ...document,
      downloadUrl: `/api/client/documents/${document.id}/download`
    })),
    requestFiles
  });
}
