import 'server-only';

import { prisma } from '@/lib/prisma';

export const ADMIN_USED_EQUIPMENT_PAGE_SIZE = 25;

export function parseUsedEquipmentPage(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? '1', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function getAdminUsedEquipmentPage({
  page,
  pageSize = ADMIN_USED_EQUIPMENT_PAGE_SIZE
}: {
  page: number;
  pageSize?: number;
}) {
  const totalCount = await prisma.usedEquipment.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);

  const items = await prisma.usedEquipment.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (normalizedPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      slug: true,
      title: true,
      equipmentType: true,
      manufacturerName: true,
      year: true,
      status: true,
      publishedAt: true,
      archivedAt: true,
      soldAt: true,
      createdAt: true,
      updatedAt: true,
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        select: {
          id: true,
          url: true,
          alt: true,
          width: true,
          height: true
        }
      },
      _count: {
        select: {
          inquiries: true
        }
      }
    }
  });

  return {
    items,
    page: normalizedPage,
    pageSize,
    requestedPage: page,
    totalCount,
    totalPages
  };
}
