import 'server-only';

import type { UserRole, UserStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type TeamInvitationState = 'active' | 'expired' | 'revoked' | 'used' | 'missing';

export type AdminTeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: Extract<UserRole, 'ADMIN' | 'MANAGER'>;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  invitation: {
    state: TeamInvitationState;
    expiresAt: string | null;
  } | null;
};

const ROLE_ORDER: Record<AdminTeamMember['role'], number> = { ADMIN: 0, MANAGER: 1 };
const STATUS_ORDER: Record<UserStatus, number> = { INVITED: 0, ACTIVE: 1, DISABLED: 2 };

function invitationState(
  invitation: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date } | undefined,
  now: Date
): TeamInvitationState {
  if (!invitation) return 'missing';
  if (invitation.usedAt) return 'used';
  if (invitation.revokedAt) return 'revoked';
  if (invitation.expiresAt <= now) return 'expired';
  return 'active';
}

export async function getAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      managerInvitations: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { usedAt: true, revokedAt: true, expiresAt: true }
      }
    }
  });
  const usersWithPassword = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, passwordHash: { not: null } },
    select: { id: true }
  });

  const passwordUserIds = new Set(usersWithPassword.map((user) => user.id));

  return users
    .map((user): AdminTeamMember => {
      const latestInvitation = user.managerInvitations[0];
      const isManager = user.role === 'MANAGER';

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as AdminTeamMember['role'],
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        hasPassword: passwordUserIds.has(user.id),
        invitation: isManager && user.status === 'INVITED'
          ? {
              state: invitationState(latestInvitation, now),
              expiresAt: latestInvitation?.expiresAt.toISOString() ?? null
            }
          : null
      };
    })
    .sort((left, right) => {
      const roleDifference = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
      if (roleDifference !== 0) return roleDifference;

      const statusDifference = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
      if (statusDifference !== 0) return statusDifference;

      return (left.name || left.email || '').localeCompare(right.name || right.email || '', 'uk');
    });
}
