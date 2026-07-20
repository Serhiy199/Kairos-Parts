import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type UserRole, type UserStatus } from '@prisma/client';

import { createAuditLog } from '@/lib/audit-log/service';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { buildAbsoluteUrl } from '@/lib/site-url';
import {
  classifyManagerInvitation,
  getManagerInvitationExpiry,
  isValidManagerEmail,
  isValidManagerName,
  normalizeManagerEmail,
  normalizeManagerName,
  MANAGER_INVITATION_TOKEN_BYTES,
  type ManagerInvitationState
} from './manager-invitation-rules';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type InvitationErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'email_conflict'
  | 'manager_not_found'
  | 'manager_not_invited'
  | 'invitation_inactive';

export class ManagerInvitationError extends Error {
  constructor(
    public readonly code: InvitationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ManagerInvitationError';
  }
}

export type ManagerInvitationValidation =
  | {
      state: 'active';
      manager: { name: string; email: string };
      expiresAt: Date;
    }
  | { state: Exclude<ManagerInvitationState, 'active'> };

export function generateManagerInvitationToken() {
  return randomBytes(MANAGER_INVITATION_TOKEN_BYTES).toString('base64url');
}

export function hashManagerInvitationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildManagerInvitationUrl(token: string) {
  return buildAbsoluteUrl(`/invitation/manager/${encodeURIComponent(token)}`);
}

export async function createInvitedManager(input: {
  name: string;
  email: string;
  createdByAdminId: string;
}) {
  const name = normalizeManagerName(input.name);
  const email = normalizeManagerEmail(input.email);

  if (!isValidManagerName(name) || !isValidManagerEmail(email)) {
    throw new ManagerInvitationError('invalid_input', 'Перевірте ім’я та email менеджера.');
  }

  const token = generateManagerInvitationToken();
  const tokenHash = hashManagerInvitationToken(token);
  const expiresAt = getManagerInvitationExpiry();

  const manager = await prisma
    .$transaction(
      async (tx) => {
        await requireActiveAdmin(tx, input.createdByAdminId);

        const existingUser = await tx.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, role: true, status: true }
        });

        if (existingUser) {
          throw new ManagerInvitationError(
            'email_conflict',
            getExistingUserConflictMessage(existingUser)
          );
        }

        const created = await tx.user.create({
        data: {
          name,
          email,
          role: 'MANAGER',
          status: 'INVITED',
          passwordHash: null,
          authVersion: 1,
          managerProfile: { create: { displayName: name } }
        },
        select: { id: true, name: true, email: true, role: true, status: true, authVersion: true }
      });

        const invitation = await tx.managerInvitation.create({
        data: {
          userId: created.id,
          tokenHash,
          expiresAt,
          createdById: input.createdByAdminId
        },
        select: { id: true }
      });

        await createAuditLog(tx, {
        actorId: input.createdByAdminId,
        entityType: 'USER',
        entityId: created.id,
        action: 'MANAGER_INVITATION_CREATED',
        newValue: { role: 'MANAGER', status: 'INVITED' },
        metadata: {
          event: 'MANAGER_INVITATION_CREATED',
          managerId: created.id,
          email,
          createdById: input.createdByAdminId,
          invitationId: invitation.id,
          expiresAt: expiresAt.toISOString()
        }
      });

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ManagerInvitationError(
          'email_conflict',
          'Користувач із таким email уже існує. Зміна ролі має виконуватися окремо.'
        );
      }

      throw error;
    });

  return {
    manager,
    invitationUrl: buildManagerInvitationUrl(token),
    expiresAt
  };
}

export async function validateManagerInvitationToken(token: string): Promise<ManagerInvitationValidation> {
  if (!TOKEN_PATTERN.test(token)) {
    return { state: 'invalid' };
  }

  const invitation = await prisma.managerInvitation.findUnique({
    where: { tokenHash: hashManagerInvitationToken(token) },
    select: {
      usedAt: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { name: true, email: true, role: true, status: true } }
    }
  });

  if (!invitation?.user.email) {
    return { state: 'invalid' };
  }

  const state = classifyManagerInvitation({
    usedAt: invitation.usedAt,
    revokedAt: invitation.revokedAt,
    expiresAt: invitation.expiresAt,
    userRole: invitation.user.role,
    userStatus: invitation.user.status
  });

  if (state !== 'active') {
    return { state };
  }

  return {
    state,
    manager: {
      name: invitation.user.name || 'Менеджер',
      email: invitation.user.email
    },
    expiresAt: invitation.expiresAt
  };
}

export async function activateManagerInvitation(input: { token: string; password: string }) {
  if (!TOKEN_PATTERN.test(input.token)) {
    throw inactiveInvitationError();
  }

  const preflight = await validateManagerInvitationToken(input.token);

  if (preflight.state !== 'active') {
    throw inactiveInvitationError();
  }

  const tokenHash = hashManagerInvitationToken(input.token);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const invitation = await tx.managerInvitation.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          usedAt: true,
          revokedAt: true,
          expiresAt: true,
          user: { select: { role: true, status: true, passwordHash: true } }
        }
      });

      if (
        !invitation ||
        invitation.user.passwordHash !== null ||
        classifyManagerInvitation({
          usedAt: invitation.usedAt,
          revokedAt: invitation.revokedAt,
          expiresAt: invitation.expiresAt,
          userRole: invitation.user.role,
          userStatus: invitation.user.status,
          now
        }) !== 'active'
      ) {
        throw inactiveInvitationError();
      }

      const claimed = await tx.managerInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: { usedAt: now }
      });

      if (claimed.count !== 1) {
        throw inactiveInvitationError();
      }

      const activated = await tx.user.updateMany({
        where: {
          id: invitation.userId,
          role: 'MANAGER',
          status: 'INVITED',
          passwordHash: null
        },
        data: {
          passwordHash,
          status: 'ACTIVE',
          authVersion: { increment: 1 }
        }
      });

      if (activated.count !== 1) {
        throw inactiveInvitationError();
      }

      await tx.managerInvitation.updateMany({
        where: {
          userId: invitation.userId,
          id: { not: invitation.id },
          usedAt: null,
          revokedAt: null
        },
        data: { revokedAt: now }
      });

      await createAuditLog(tx, {
        actorId: invitation.userId,
        entityType: 'USER',
        entityId: invitation.userId,
        action: 'MANAGER_ACTIVATED',
        oldValue: { role: 'MANAGER', status: 'INVITED' },
        newValue: { role: 'MANAGER', status: 'ACTIVE' },
        metadata: {
          event: 'MANAGER_ACTIVATED',
          managerId: invitation.userId,
          activatedAt: now.toISOString(),
          invitationId: invitation.id
        }
      });

      return { managerId: invitation.userId, activatedAt: now };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function regenerateManagerInvitation(input: { userId: string; actorAdminId: string }) {
  const token = generateManagerInvitationToken();
  const tokenHash = hashManagerInvitationToken(token);
  const expiresAt = getManagerInvitationExpiry();
  const now = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      await requireActiveAdmin(tx, input.actorAdminId);

      const manager = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true, status: true, passwordHash: true, name: true, email: true }
      });

      if (!manager) {
        throw new ManagerInvitationError('manager_not_found', 'Менеджера не знайдено.');
      }

      if (manager.role !== 'MANAGER' || manager.status !== 'INVITED' || manager.passwordHash !== null) {
        throw new ManagerInvitationError(
          'manager_not_invited',
          'Нове запрошення можна створити лише для неактивованого менеджера.'
        );
      }

      const revoked = await tx.managerInvitation.updateMany({
        where: { userId: manager.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now }
      });

      const invitation = await tx.managerInvitation.create({
        data: {
          userId: manager.id,
          tokenHash,
          expiresAt,
          createdById: input.actorAdminId
        },
        select: { id: true }
      });

      await createAuditLog(tx, {
        actorId: input.actorAdminId,
        entityType: 'USER',
        entityId: manager.id,
        action: 'MANAGER_INVITATION_REGENERATED',
        metadata: {
          event: 'MANAGER_INVITATION_REGENERATED',
          managerId: manager.id,
          createdById: input.actorAdminId,
          invitationId: invitation.id,
          expiresAt: expiresAt.toISOString(),
          revokedInvitationCount: revoked.count
        }
      });

      return { manager, revokedInvitationCount: revoked.count };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    ...result,
    invitationUrl: buildManagerInvitationUrl(token),
    expiresAt
  };
}

async function requireActiveAdmin(
  tx: Prisma.TransactionClient,
  actorId: string
): Promise<{ id: string; role: UserRole; status: UserStatus }> {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, status: true }
  });

  if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
    throw new ManagerInvitationError('forbidden', 'Недостатньо прав для створення запрошення.');
  }

  return actor;
}

function inactiveInvitationError() {
  return new ManagerInvitationError(
    'invitation_inactive',
    'Посилання вже використане або більше не активне.'
  );
}

function getExistingUserConflictMessage(user: { role: UserRole; status: UserStatus }) {
  if (user.role === 'MANAGER' && user.status === 'INVITED') {
    return 'Менеджера вже запрошено. Створіть нове посилання через повторну генерацію.';
  }

  if (user.role === 'MANAGER' && user.status === 'DISABLED') {
    return 'Доступ цього менеджера вимкнено. Скористайтеся дією повторної активації.';
  }

  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    return 'Користувач із таким email уже має доступ до команди.';
  }

  return 'Клієнт із таким email уже існує. Зміна ролі має виконуватися окремо.';
}
