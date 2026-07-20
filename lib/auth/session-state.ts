import type { UserRole, UserStatus } from '@prisma/client';

export type CurrentAuthenticatedUserState = {
  id: string;
  role: UserRole;
  status: UserStatus;
  authVersion: number;
};

export type SessionStateClaims = {
  userId?: string;
  role?: UserRole;
  status?: UserStatus;
  authVersion?: number;
};

export type SessionStateValidation =
  | { ok: true; user: CurrentAuthenticatedUserState }
  | {
      ok: false;
      reason:
        | 'legacy_token'
        | 'missing_user'
        | 'inactive_user'
        | 'role_mismatch'
        | 'status_mismatch'
        | 'auth_version_mismatch';
    };

export function validateCurrentSessionState(
  claims: SessionStateClaims,
  currentUser: CurrentAuthenticatedUserState | null
): SessionStateValidation {
  if (!claims.userId || !claims.role || !claims.status || !Number.isInteger(claims.authVersion)) {
    return { ok: false, reason: 'legacy_token' };
  }

  if (!currentUser || currentUser.id !== claims.userId) {
    return { ok: false, reason: 'missing_user' };
  }

  if (currentUser.status !== 'ACTIVE') {
    return { ok: false, reason: 'inactive_user' };
  }

  if (currentUser.role !== claims.role) {
    return { ok: false, reason: 'role_mismatch' };
  }

  if (currentUser.status !== claims.status) {
    return { ok: false, reason: 'status_mismatch' };
  }

  if (currentUser.authVersion !== claims.authVersion) {
    return { ok: false, reason: 'auth_version_mismatch' };
  }

  return { ok: true, user: currentUser };
}

export function canAuthenticateWithCredentials(input: { status: UserStatus; hasPassword: boolean }) {
  return input.status === 'ACTIVE' && input.hasPassword;
}
