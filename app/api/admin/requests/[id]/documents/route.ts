import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { saveRequestDocumentLocal } from '@/lib/files/local-storage';
import { prisma } from '@/lib/prisma';
import { parseRequestDocumentMetadata, readRequiredRequestDocumentFile } from '@/lib/request-documents/validation';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const documents = await prisma.requestDocument.findMany({
    where: { requestId: id },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, name: true, email: true, role: true } } }
  });

  return Response.json({ documents });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const formData = await request.formData();
  const metadata = parseRequestDocumentMetadata(formData);
  const fileResult = readRequiredRequestDocumentFile(formData);

  if (!metadata.ok) {
    return Response.json({ status: 'validation_error', message: metadata.error }, { status: 400 });
  }

  if (!fileResult.ok) {
    return Response.json({ status: 'validation_error', message: fileResult.error }, { status: 400 });
  }

  const requestRecord = await prisma.request.findUnique({
    where: { id },
    select: { id: true, requestNumber: true, companyId: true }
  });

  if (!requestRecord) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  try {
    const savedFile = await saveRequestDocumentLocal(requestRecord.id, fileResult.file);
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.requestDocument.create({
        data: {
          requestId: requestRecord.id,
          type: metadata.data.type,
          title: metadata.data.title,
          fileName: savedFile.fileName,
          fileUrl: savedFile.fileUrl,
          storageKey: savedFile.storageKey,
          mimeType: savedFile.mimeType,
          size: savedFile.size,
          visibleToClient: metadata.data.visibleToClient,
          uploadedById: access.session.user.id
        }
      });
      await writeAuditLog(tx, {
        actor: auditUserActor(access.session.user.id),
        companyId: requestRecord.companyId,
        entityType: 'REQUEST_DOCUMENT',
        entityId: created.id,
        entityLabel: created.title || created.fileName,
        action: 'DOCUMENT_UPLOADED',
        category: 'STANDARD',
        newValue: {
          documentId: created.id, fileName: created.fileName, documentType: created.type,
          title: created.title, visibility: created.visibleToClient, requestId: created.requestId,
          size: created.size, mimeType: created.mimeType
        },
        metadata: { source: 'ADMIN_CRM', requestNumber: requestRecord.requestNumber },
        allowedFields: {
          newValue: ['documentId', 'fileName', 'documentType', 'title', 'visibility', 'requestId', 'size', 'mimeType'],
          metadata: ['source', 'requestNumber']
        },
        requestContext: auditRequestContextFromHeaders(request.headers)
      });
      return created;
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Failed to upload request document via API', error);
    return Response.json(
      {
        status: 'upload_error',
        message: 'Не вдалося завантажити документ. Спробуйте менший файл або повторіть пізніше.'
      },
      { status: 500 }
    );
  }
}
