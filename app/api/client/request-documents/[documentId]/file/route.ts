import { getClientApiSession, requestAccessWhere } from '@/lib/client/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { contentDispositionFileName, isSafeStorageKey, readLocalUpload } from '@/lib/files/secure-local-file';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const authResult = await getClientApiSession();

  if (!authResult.ok) {
    return Response.json({ status: authResult.status }, { status: authResult.statusCode });
  }

  const access = authResult.access;

  const { documentId } = await params;
  const document = await prisma.requestDocument.findFirst({
    where: {
      id: documentId,
      visibleToClient: true,
      request: requestAccessWhere(access)
    },
    select: {
      id: true,
      requestId: true,
      type: true,
      title: true,
      fileName: true,
      storageKey: true,
      fileUrl: true,
      mimeType: true,
      size: true,
      request: { select: { requestNumber: true, companyId: true } }
    }
  });

  if (!document) {
    return Response.json({ status: 'document_not_found' }, { status: 404 });
  }

  const auditDownload = async () => {
    if (document.type !== 'INVOICE' && document.type !== 'COMMERCIAL_OFFER') return;
    await writeAuditLog(prisma, {
      actor: auditUserActor(authResult.session.user.id),
      companyId: document.request.companyId,
      entityType: 'REQUEST_DOCUMENT',
      entityId: document.id,
      entityLabel: document.title || document.fileName,
      action: 'DOCUMENT_DOWNLOADED',
      category: 'CRITICAL_READ',
      metadata: {
        source: 'CLIENT_CABINET', requestId: document.requestId, requestNumber: document.request.requestNumber,
        fileName: document.fileName, documentType: document.type, visibility: true,
        size: document.size, mimeType: document.mimeType
      },
      allowedFields: {
        metadata: ['source', 'requestId', 'requestNumber', 'fileName', 'documentType', 'visibility', 'size', 'mimeType']
      },
      requestContext: auditRequestContextFromHeaders(request.headers)
    });
  };

  if (document.fileUrl) {
    await auditDownload();
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

  await auditDownload();

  return new Response(localFile.buffer, {
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${contentDispositionFileName(document.fileName)}"`,
      'Cache-Control': 'private, max-age=60'
    }
  });
}
