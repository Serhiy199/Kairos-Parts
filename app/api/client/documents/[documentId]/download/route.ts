import { clientAccessError, documentAccessWhere, getClientApiSession } from '@/lib/client/access';
import { documentContentDisposition, fetchDocument } from '@/lib/files/cloudinary-vehicle-documents';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const accessResult = await getClientApiSession();
  if (!accessResult.ok) return clientAccessError(accessResult);

  const { documentId } = await params;
  const { access } = accessResult;

  const document = await prisma.document.findFirst({
    where: { id: documentId, visibleToClient: true, AND: [documentAccessWhere(access)] },
    select: { fileName: true, storageKey: true, mimeType: true, size: true }
  });
  if (!document) return Response.json({ status: 'document_not_found' }, { status: 404 });

  const file = await fetchDocument(document.storageKey);
  if (!file.ok) return Response.json({ status: 'file_not_available' }, { status: 404 });

  return new Response(file.buffer, {
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Length': String(document.size),
      'Content-Disposition': documentContentDisposition(document.fileName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    }
  });
}
