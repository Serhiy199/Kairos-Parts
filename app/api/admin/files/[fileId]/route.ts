import { getCrmApiSession, crmAccessError } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  loadRequestFileBytes,
  requestFileContentDisposition,
  RequestFileStorageError
} from '@/lib/files/request-file-storage';
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
      storageProvider: true,
      storageStatus: true,
      storagePublicId: true,
      storageResourceType: true,
      storageDeliveryType: true,
      storageVersion: true,
      storageFormat: true,
      storageChecksumSha256: true,
      request: { select: { requestNumber: true, companyId: true } }
    }
  });

  if (!file) {
    return Response.json({ status: 'file_not_found' }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await loadRequestFileBytes(file);
  } catch (error) {
    if (error instanceof RequestFileStorageError) {
      return Response.json(
        { status: error.code.toLowerCase(), message: error.message },
        { status: error.httpStatus }
      );
    }
    return Response.json(
      { status: 'request_file_storage_unavailable', message: 'Файл тимчасово недоступний.' },
      { status: 503 }
    );
  }

  await writeAuditLog(prisma, {
    actor: auditUserActor(session.session.user.id),
    companyId: file.request.companyId,
    entityType: 'REQUEST_FILE',
    entityId: file.id,
    entityLabel: file.fileName,
    action: 'REQUEST_FILE_DOWNLOADED',
    category: 'CRITICAL_READ',
    metadata: {
      source: 'ADMIN_CRM',
      requestId: file.requestId,
      requestNumber: file.request.requestNumber,
      storageProvider: file.storageProvider,
      sizeBytes: file.size,
      mimeType: file.mimeType
    },
    allowedFields: {
      metadata: [
        'source',
        'requestId',
        'requestNumber',
        'storageProvider',
        'sizeBytes',
        'mimeType'
      ]
    },
    requestContext: auditRequestContextFromHeaders(request.headers)
  });

  const inline = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': requestFileContentDisposition(file.fileName, inline),
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
