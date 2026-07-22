import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { auditRequestContextFromHeaders } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { fetchVehicleDocument, vehicleDocumentContentDisposition } from '@/lib/files/cloudinary-vehicle-documents';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await getCrmApiSession();
  if (!access.ok) return crmAccessError(access);

  const { documentId } = await params;
  const document = await prisma.document.findFirst({
    where: { id: documentId, vehicleId: { not: null } },
    select: {
      id: true, vehicleId: true, companyId: true, fileName: true, storageKey: true,
      mimeType: true, size: true, visibleToClient: true
    }
  });
  if (!document) return Response.json({ status: 'document_not_found' }, { status: 404 });

  const file = await fetchVehicleDocument(document.storageKey);
  if (!file.ok) return Response.json({ status: 'file_not_available' }, { status: 404 });

  if (!document.visibleToClient) {
    await writeAuditLog(prisma, {
      actor: auditUserActor(access.session.user.id),
      companyId: document.companyId,
      entityType: 'DOCUMENT',
      entityId: document.id,
      entityLabel: document.fileName,
      action: 'DOCUMENT_DOWNLOADED',
      category: 'CRITICAL_READ',
      metadata: {
        source: 'ADMIN_CRM', fileName: document.fileName, visibility: document.visibleToClient,
        vehicleId: document.vehicleId, size: document.size, mimeType: document.mimeType
      },
      allowedFields: { metadata: ['source', 'fileName', 'visibility', 'vehicleId', 'size', 'mimeType'] },
      requestContext: auditRequestContextFromHeaders(request.headers)
    });
  }

  return new Response(file.buffer, {
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Length': String(document.size),
      'Content-Disposition': vehicleDocumentContentDisposition(document.fileName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    }
  });
}
