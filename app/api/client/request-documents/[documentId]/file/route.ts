import { auth } from '@/auth';
import { getClientAccessContext, requestAccessWhere } from '@/lib/client/access';
import { contentDispositionFileName, isSafeStorageKey, readLocalUpload } from '@/lib/files/secure-local-file';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'CLIENT') {
    return Response.json({ status: 'unauthorized' }, { status: 401 });
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return Response.json({ status: 'forbidden' }, { status: 403 });
  }

  const { documentId } = await params;
  const document = await prisma.requestDocument.findFirst({
    where: {
      id: documentId,
      visibleToClient: true,
      request: requestAccessWhere(access)
    },
    select: {
      fileName: true,
      storageKey: true,
      fileUrl: true,
      mimeType: true
    }
  });

  if (!document) {
    return Response.json({ status: 'document_not_found' }, { status: 404 });
  }

  if (document.fileUrl) {
    return Response.redirect(document.fileUrl);
  }

  if (!isSafeStorageKey(document.storageKey)) {
    return Response.json({ status: 'file_not_found' }, { status: 404 });
  }

  const localFile = await readLocalUpload(document.storageKey as string);

  if (!localFile.ok && localFile.status === 'invalid_storage_key') {
    return Response.json({ status: 'invalid_storage_key' }, { status: 400 });
  }

  if (!localFile.ok) {
    return Response.json(
      {
        status: 'file_not_available',
        message: 'File is not available in local storage. Production needs persistent object storage.'
      },
      { status: 404 }
    );
  }

  return new Response(localFile.buffer, {
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${contentDispositionFileName(document.fileName)}"`,
      'Cache-Control': 'private, max-age=60'
    }
  });
}
