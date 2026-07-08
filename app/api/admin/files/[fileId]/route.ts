import { getCrmApiSession, crmAccessError } from '@/lib/admin/access';
import { contentDispositionFileName, isSafeStorageKey, readLocalUpload } from '@/lib/files/secure-local-file';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getCrmApiSession();

  if (!session.ok) {
    return crmAccessError(session);
  }

  const { fileId } = await params;
  const file = await prisma.requestFile.findUnique({
    where: { id: fileId },
    select: {
      fileName: true,
      storageKey: true,
      mimeType: true
    }
  });

  if (!file || !isSafeStorageKey(file.storageKey)) {
    return Response.json({ status: 'file_not_found' }, { status: 404 });
  }

  const localFile = await readLocalUpload(file.storageKey);

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
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${contentDispositionFileName(file.fileName)}"`,
      'Cache-Control': 'private, max-age=60'
    }
  });
}
