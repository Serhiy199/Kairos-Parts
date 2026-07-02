import type { Prisma } from '@prisma/client';

import { crmAccessError, getCrmApiSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';
import { REQUEST_SOURCES } from '@/lib/requests/sources';
import { REQUEST_STATUSES } from '@/lib/requests/statuses';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const access = await getCrmApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  const { searchParams } = new URL(request.url);
  const where: Prisma.RequestWhereInput = {};
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const manager = searchParams.get('manager');
  const category = searchParams.get('category');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const q = searchParams.get('q')?.trim();

  if (status && REQUEST_STATUSES.includes(status as never)) {
    where.status = status as never;
  }

  if (source && REQUEST_SOURCES.includes(source as never)) {
    where.source = source as never;
  }

  if (manager) {
    where.assignedManagerId = manager;
  }

  if (category) {
    where.categoryId = category;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {})
    };
  }

  if (q) {
    where.OR = [
      { requestNumber: { contains: q, mode: 'insensitive' } },
      { guestPhone: { contains: q, mode: 'insensitive' } },
      { guestName: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { vinOrSerial: { contains: q, mode: 'insensitive' } },
      { client: { contactName: { contains: q, mode: 'insensitive' } } },
      { client: { companyName: { contains: q, mode: 'insensitive' } } },
      { client: { phone: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        client: { select: { contactName: true, companyName: true, phone: true } },
        category: { select: { id: true, name: true } },
        assignedManager: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.request.count({ where })
  ]);

  return Response.json({ items, pagination: { page: 1, pageSize: 100, total } });
}
