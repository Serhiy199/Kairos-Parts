import 'server-only';

import type { AuditLogCategory, UserRole, UserStatus } from '@prisma/client';

import {
  AUDIT_LOG_PAGE_SIZE,
  buildAuditLogWhere,
  type AuditLogFilters
} from '@/lib/audit-log/filters';
import { auditLogInclude } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';

export async function getAuditLogPage(filters: AuditLogFilters, fixedActorId?: string) {
  const where = buildAuditLogWhere(filters, fixedActorId);
  const totalCount = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / AUDIT_LOG_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const records = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
    take: AUDIT_LOG_PAGE_SIZE,
    include: auditLogInclude
  });

  return { records, page, pageSize: AUDIT_LOG_PAGE_SIZE, totalCount, totalPages };
}

export async function getAuditLogEvent(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: auditLogInclude
  });
}

export async function getAuditActorOptions() {
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    orderBy: [{ name: 'asc' }, { email: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, email: true, role: true, status: true }
  });
}

export type AuditActivityMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: Extract<UserRole, 'ADMIN' | 'MANAGER'>;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAuditActivityMember(userId: string): Promise<AuditActivityMember | null> {
  const member = await prisma.user.findFirst({
    where: { id: userId, role: { in: ['ADMIN', 'MANAGER'] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return member as AuditActivityMember | null;
}

export async function getManagerActivitySummary(userId: string) {
  const [totalCount, categories, latest] = await Promise.all([
    prisma.auditLog.count({ where: { actorId: userId } }),
    prisma.auditLog.groupBy({
      by: ['category'],
      where: { actorId: userId },
      _count: { _all: true }
    }),
    prisma.auditLog.findFirst({
      where: { actorId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true }
    })
  ]);
  const categoryCounts = new Map<AuditLogCategory, number>(
    categories.map((item) => [item.category, item._count._all])
  );

  return {
    totalCount,
    standard: categoryCounts.get('STANDARD') ?? 0,
    financialCritical: categoryCounts.get('FINANCIAL_CRITICAL') ?? 0,
    criticalRead: categoryCounts.get('CRITICAL_READ') ?? 0,
    latestActivityAt: latest?.createdAt ?? null
  };
}
