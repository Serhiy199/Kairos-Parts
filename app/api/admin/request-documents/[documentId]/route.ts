import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';
import { parseRequestDocumentMetadata } from '@/lib/request-documents/validation';

export const runtime = 'nodejs';

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
    select: { id: true }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  const document = await prisma.requestDocument.update({
    where: { id: documentId },
    data: metadata.data
  });

  return Response.json({ document });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { documentId } = await params;
  const existing = await prisma.requestDocument.findUnique({
    where: { id: documentId },
    select: { id: true }
  });

  if (!existing) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  await prisma.requestDocument.delete({
    where: { id: documentId }
  });

  return Response.json({ status: 'deleted' });
}
