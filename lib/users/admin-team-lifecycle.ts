import 'server-only';

import { Prisma } from '@prisma/client';

import { createAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';
import { assertUserStatusTransition } from './lifecycle-rules';
import {
  assertManagerLifecycleTransition,
  ManagerLifecycleError,
  type ManagerAccessTargetStatus
} from './admin-team-rules';

async function requireActiveAdmin(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, status: true }
  });

  if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
    throw new ManagerLifecycleError('invalid_target', 'Недостатньо прав для керування командою.');
  }

  return actor;
}

export async function setManagerAccessStatus(input: {
  managerId: string;
  actorAdminId: string;
  targetStatus: ManagerAccessTargetStatus;
}) {
  return prisma.$transaction(
    async (tx) => {
      const actor = await requireActiveAdmin(tx, input.actorAdminId);
      const manager = await tx.user.findUnique({
        where: { id: input.managerId },
        select: { id: true, role: true, status: true, passwordHash: true }
      });

      assertManagerLifecycleTransition({
        exists: Boolean(manager),
        role: manager?.role,
        status: manager?.status,
        hasPassword: Boolean(manager?.passwordHash),
        targetStatus: input.targetStatus
      });

      if (!manager) {
        throw new ManagerLifecycleError('manager_not_found', 'Менеджера не знайдено.');
      }

      assertUserStatusTransition(manager.status, input.targetStatus);

      const updated = await tx.user.updateMany({
        where: {
          id: manager.id,
          role: 'MANAGER',
          status: manager.status
        },
        data: {
          status: input.targetStatus,
          authVersion: { increment: 1 }
        }
      });

      if (updated.count !== 1) {
        throw new ManagerLifecycleError('invalid_transition', 'Статус менеджера вже змінився. Оновіть сторінку.');
      }

      const event = input.targetStatus === 'DISABLED' ? 'MANAGER_DISABLED' : 'MANAGER_ENABLED';

      await createAuditLog(tx, {
        actorId: actor.id,
        entityType: 'USER',
        entityId: manager.id,
        action: 'ENTITY_UPDATED',
        oldValue: { role: 'MANAGER', status: manager.status },
        newValue: { role: 'MANAGER', status: input.targetStatus },
        metadata: {
          event,
          managerId: manager.id,
          previousStatus: manager.status,
          newStatus: input.targetStatus,
          actorRole: 'ADMIN'
        }
      });

      return { managerId: manager.id, status: input.targetStatus };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
