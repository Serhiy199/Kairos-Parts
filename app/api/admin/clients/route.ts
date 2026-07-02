import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const clients = await prisma.clientProfile.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      _count: { select: { requests: true, vehicles: true, documents: true } },
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, requestNumber: true, createdAt: true }
      }
    }
  });

  return Response.json({ items: clients });
}
