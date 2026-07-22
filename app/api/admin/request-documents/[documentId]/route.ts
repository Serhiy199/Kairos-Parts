import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import { parseRequestDocumentMetadata } from '@/lib/request-documents/validation';

export const runtime = 'nodejs';

const DOCUMENT_FIELDS = [
  'documentId', 'fileName', 'documentType', 'title', 'visibility',
  'requestId', 'size', 'mimeType'
] as const;

function snapshot(document: {
  id: string; requestId: string; type: string; title: string; fileName: string;
  visibleToClient: boolean; size: number | null; mimeType: string | null;
}) {
  return {
    documentId: document.id,
    fileName: document.fileName,
    documentType: document.type,
    title: document.title,
    visibility: document.visibleToClient,
    requestId: document.requestId,
    size: document.size,
    mimeType: document.mimeType
  };
}

function isFinancial(type: string) {
  return type === 'INVOICE' || type === 'COMMERCIAL_OFFER';
}

export async function PATCH(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { documentId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return Response.json({ status: 'invalid_json' }, { status: 400 });
  }

  const metadata = parseRequestDocumentMetadata(body);

  if (!metadata.ok) {
    return Response.json({ status: 'validation_error', message: metadata.error }, { status: 400 });
  }

  const existing = await prisma.requestDocument.findUnique({
    where: { id: documentId },
    include: { request: { select: { requestNumber: true, companyId: true } } }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const document = await prisma.$transaction(async (tx) => {
    const updated = await tx.requestDocument.update({ where: { id: documentId }, data: metadata.data });
    const before = snapshot(existing);
    const after = snapshot(updated);
    const diff = buildAuditDiff(before, after, DOCUMENT_FIELDS);
    const action = before.title !== after.title && before.visibility === after.visibility && before.documentType === after.documentType
      ? 'DOCUMENT_RENAMED' as const
      : before.visibility !== after.visibility && before.title === after.title && before.documentType === after.documentType
        ? 'DOCUMENT_VISIBILITY_CHANGED' as const
        : 'DOCUMENT_UPDATED' as const;
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: existing.request.companyId,
      entityType: 'REQUEST_DOCUMENT',
      entityId: existing.id,
      entityLabel: updated.title || updated.fileName,
      action,
      category: before.documentType !== after.documentType && (isFinancial(before.documentType) || isFinancial(after.documentType))
        ? 'FINANCIAL_CRITICAL'
        : 'STANDARD',
      oldValue: diff.before,
      newValue: diff.after,
      metadata: { source: 'ADMIN_CRM', requestNumber: existing.request.requestNumber },
      allowedFields: { oldValue: DOCUMENT_FIELDS, newValue: DOCUMENT_FIELDS, metadata: ['source', 'requestNumber'] },
      requestContext: auditRequestContextFromHeaders(request.headers)
    });
    return updated;
  });

  return Response.json({ document });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { documentId } = await params;
  const existing = await prisma.requestDocument.findUnique({
    where: { id: documentId },
    include: { request: { select: { requestNumber: true, companyId: true } } }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      actor: auditUserActor(access.session.user.id),
      companyId: existing.request.companyId,
      entityType: 'REQUEST_DOCUMENT',
      entityId: existing.id,
      entityLabel: existing.title || existing.fileName,
      action: 'DOCUMENT_DELETED',
      category: isFinancial(existing.type) ? 'FINANCIAL_CRITICAL' : 'STANDARD',
      oldValue: snapshot(existing),
      metadata: { source: 'ADMIN_CRM', requestNumber: existing.request.requestNumber },
      allowedFields: { oldValue: DOCUMENT_FIELDS, metadata: ['source', 'requestNumber'] },
      requestContext: auditRequestContextFromHeaders(request.headers)
    });
    await tx.requestDocument.delete({ where: { id: documentId } });
  });

  return Response.json({ status: 'deleted' });
}
