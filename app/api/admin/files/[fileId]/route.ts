import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { getCrmApiSession, crmAccessError } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isSafeStorageKey(storageKey: string) {
  return Boolean(storageKey) && !path.isAbsolute(storageKey) && !storageKey.split(/[\\/]/).includes('..');
}

function resolveUploadPath(storageKey: string) {
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const filePath = path.resolve(uploadsRoot, storageKey);

  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

function contentDispositionFileName(fileName: string) {
  return fileName.replace(/["\r\n]/g, '_');
}

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

  const filePath = resolveUploadPath(file.storageKey);

  if (!filePath) {
    return Response.json({ status: 'invalid_storage_key' }, { status: 400 });
  }

  try {
    await stat(filePath);
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${contentDispositionFileName(file.fileName)}"`,
        'Cache-Control': 'private, max-age=60'
      }
    });
  } catch {
    return Response.json(
      {
        status: 'file_not_available',
        message: 'File is not available in local storage. Production needs persistent object storage.'
      },
      { status: 404 }
    );
  }
}
