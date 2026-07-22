import { getCrmApiSession, crmAccessError } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { contentDispositionFileName, isSafeStorageKey, readLocalUpload } from '@/lib/files/secure-local-file';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getCrmApiSession();

  if (!session.ok) {
    return crmAccessError(session);
  }

  const { fileId } = await params;
  const file = await prisma.requestFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      requestId: true,
      fileName: true,
      storageKey: true,
      mimeType: true,
      size: true,
      request: { select: { requestNumber: true, companyId: true } }
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

  await writeAuditLog(prisma, {
    actor: auditUserActor(session.session.user.id),
    companyId: file.request.companyId,
    entityType: 'DOCUMENT',
    entityId: file.id,
    entityLabel: file.fileName,
    action: 'DOCUMENT_DOWNLOADED',
    category: 'CRITICAL_READ',
    metadata: {
      source: 'ADMIN_CRM', requestId: file.requestId, requestNumber: file.request.requestNumber,
      fileName: file.fileName, size: file.size, mimeType: file.mimeType
    },
    allowedFields: { metadata: ['source', 'requestId', 'requestNumber', 'fileName', 'size', 'mimeType'] },
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  return new Response(localFile.buffer, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${contentDispositionFileName(file.fileName)}"`,
      'Cache-Control': 'private, max-age=60'
    }
  });
}
