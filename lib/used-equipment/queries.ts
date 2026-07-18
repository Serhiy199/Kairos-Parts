import 'server-only';

import { prisma } from '@/lib/prisma';

export const ADMIN_USED_EQUIPMENT_PAGE_SIZE = 25;
export const ADMIN_USED_EQUIPMENT_INQUIRY_PAGE_SIZE = 25;
export const PUBLIC_USED_EQUIPMENT_PAGE_SIZE = 12;

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

export async function getPublicUsedEquipmentPage({
  page,
  pageSize = PUBLIC_USED_EQUIPMENT_PAGE_SIZE
}: {
  page: number;
  pageSize?: number;
}) {
  const totalCount = await prisma.usedEquipment.count({
    where: {
      status: 'PUBLISHED'
    }
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);

  const items =
    totalCount === 0
      ? []
      : await prisma.usedEquipment.findMany({
          where: {
            status: 'PUBLISHED'
          },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          skip: (normalizedPage - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            slug: true,
            title: true,
            equipmentType: true,
            manufacturerName: true,
            year: true,
            description: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              take: 1,
              select: {
                url: true,
                alt: true,
                width: true,
                height: true
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

export type PublicUsedEquipmentListItem = Awaited<ReturnType<typeof getPublicUsedEquipmentPage>>['items'][number];

export async function getPublicUsedEquipmentBySlug(slug: string) {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    return null;
  }

  return prisma.usedEquipment.findFirst({
    where: {
      slug: normalizedSlug,
      status: 'PUBLISHED'
    },
    select: {
      id: true,
      slug: true,
      title: true,
      equipmentType: true,
      manufacturerName: true,
      year: true,
      description: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          url: true,
          alt: true,
          width: true,
          height: true,
          isPrimary: true,
          sortOrder: true
        }
      }
    }
  });
}

export type PublicUsedEquipmentDetail = NonNullable<Awaited<ReturnType<typeof getPublicUsedEquipmentBySlug>>>;

export async function getNewUsedEquipmentInquiryCount() {
  return prisma.usedEquipmentInquiry.count({
    where: {
      status: 'NEW'
    }
  });
}

export async function getAdminUsedEquipmentInquiryPage({
  page,
  pageSize = ADMIN_USED_EQUIPMENT_INQUIRY_PAGE_SIZE
}: {
  page: number;
  pageSize?: number;
}) {
  const totalCount = await prisma.usedEquipmentInquiry.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);

  const items =
    totalCount === 0
      ? []
      : await prisma.usedEquipmentInquiry.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (normalizedPage - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            equipmentTitle: true,
            name: true,
            phone: true,
            status: true,
            source: true,
            createdAt: true,
            assignedManager: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            usedEquipment: {
              select: {
                id: true,
                slug: true,
                title: true,
                status: true,
                images: {
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
                  take: 1,
                  select: {
                    id: true,
                    url: true,
                    alt: true,
                    width: true,
                    height: true
                  }
                }
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

export async function getAdminUsedEquipmentInquiryById(id: string) {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return null;
  }

  return prisma.usedEquipmentInquiry.findUnique({
    where: {
      id: normalizedId
    },
    select: {
      id: true,
      equipmentTitle: true,
      name: true,
      phone: true,
      normalizedPhone: true,
      status: true,
      source: true,
      internalComment: true,
      assignedManagerId: true,
      processedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedManager: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      },
      usedEquipment: {
        select: {
          id: true,
          slug: true,
          title: true,
          equipmentType: true,
          manufacturerName: true,
          year: true,
          status: true,
          internalComment: true,
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            take: 1,
            select: {
              id: true,
              url: true,
              alt: true,
              width: true,
              height: true
            }
          }
        }
      }
    }
  });
}

export async function getUsedEquipmentInquiryAssignees() {
  return prisma.user.findMany({
    where: {
      role: {
        in: ['MANAGER', 'ADMIN']
      }
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });
}
