import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { id } = await params;
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      client: true,
      category: true,
      subcategory: true,
      manufacturer: true,
      vehicle: true,
      assignedManager: { select: { id: true, name: true, email: true, role: true } },
      files: true,
      items: true,
      requestDocuments: {
        include: { uploadedBy: { select: { id: true, name: true, email: true, role: true } } }
      },
      documents: true,
      comments: {
        where: { internal: true },
        include: { author: { select: { id: true, name: true, email: true, role: true } } }
      },
      statusHistory: {
        include: { changedByUser: { select: { id: true, name: true, email: true, role: true } } }
      }
    }
  });

  if (!request) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  return Response.json({ request });
}
