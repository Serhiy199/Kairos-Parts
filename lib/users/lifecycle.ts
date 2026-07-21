import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { assertActiveAdminWillRemain, AUTH_VERSION_INCREMENT } from './lifecycle-rules';

type LifecycleDatabase = Prisma.TransactionClient | PrismaClient;

export async function incrementUserAuthVersion(userId: string, db: LifecycleDatabase = prisma) {
  return db.user.update({
    where: { id: userId },
    data: AUTH_VERSION_INCREMENT,
    select: { id: true, authVersion: true }
  });
}

export async function assertCanDisableOrDemoteAdmin(userId: string, db: LifecycleDatabase = prisma) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true }
  });

  if (!target || target.role !== 'ADMIN' || target.status !== 'ACTIVE') {
    return;
  }

  const activeAdminCount = await db.user.count({
    where: { role: 'ADMIN', status: 'ACTIVE' }
  });

  assertActiveAdminWillRemain({
    targetRole: target.role,
    targetStatus: 'DISABLED',
    activeAdminCount
  });
}
