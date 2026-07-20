import type { Session } from 'next-auth';
import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import {
  validateCurrentSessionState,
  type CurrentAuthenticatedUserState,
  type SessionStateValidation
} from './session-state';

export const getCurrentAuthenticatedUserState = cache(
  async (userId: string): Promise<CurrentAuthenticatedUserState | null> =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        authVersion: true
      }
    })
);

export async function validateSessionAgainstCurrentUser(session: Session | null): Promise<SessionStateValidation> {
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const status = session?.user?.status;

  if (!userId || !role || !status) {
    return { ok: false, reason: 'legacy_token' };
  }

  const currentUser = await getCurrentAuthenticatedUserState(userId);

  if (!currentUser) {
    return { ok: false, reason: 'missing_user' };
  }

  if (currentUser.status !== 'ACTIVE') {
    return { ok: false, reason: 'inactive_user' };
  }

  if (currentUser.role !== role) {
    return { ok: false, reason: 'role_mismatch' };
  }

  if (currentUser.status !== status) {
    return { ok: false, reason: 'status_mismatch' };
  }

  return { ok: true, user: currentUser };
}

export async function validateJwtClaimsAgainstCurrentUser(claims: {
  userId?: string;
  role?: CurrentAuthenticatedUserState['role'];
  status?: CurrentAuthenticatedUserState['status'];
  authVersion?: number;
}) {
  const currentUser = claims.userId ? await getCurrentAuthenticatedUserState(claims.userId) : null;
  return validateCurrentSessionState(claims, currentUser);
}
