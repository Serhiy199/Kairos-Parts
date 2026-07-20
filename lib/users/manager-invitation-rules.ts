import type { UserRole, UserStatus } from '@prisma/client';

export const MANAGER_INVITATION_TTL_HOURS = 48;
export const MANAGER_INVITATION_TOKEN_BYTES = 32;
export const MANAGER_PASSWORD_MIN_LENGTH = 8;
export const MANAGER_PASSWORD_MAX_LENGTH = 128;
export const MANAGER_NAME_MIN_LENGTH = 2;
export const MANAGER_NAME_MAX_LENGTH = 120;

export type ManagerInvitationState =
  | 'active'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'account_active'
  | 'account_disabled';

export function normalizeManagerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeManagerName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidManagerEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidManagerName(name: string) {
  return name.length >= MANAGER_NAME_MIN_LENGTH && name.length <= MANAGER_NAME_MAX_LENGTH;
}

export function isValidManagerPassword(password: string) {
  return password.length >= MANAGER_PASSWORD_MIN_LENGTH && password.length <= MANAGER_PASSWORD_MAX_LENGTH;
}

export function getManagerInvitationExpiry(now = new Date()) {
  return new Date(now.getTime() + MANAGER_INVITATION_TTL_HOURS * 60 * 60 * 1000);
}

export function classifyManagerInvitation(input: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  userRole: UserRole;
  userStatus: UserStatus;
  now?: Date;
}): ManagerInvitationState {
  if (input.usedAt) return 'used';
  if (input.revokedAt) return 'revoked';
  if (input.expiresAt <= (input.now ?? new Date())) return 'expired';
  if (input.userRole !== 'MANAGER') return 'invalid';
  if (input.userStatus === 'ACTIVE') return 'account_active';
  if (input.userStatus === 'DISABLED') return 'account_disabled';
  if (input.userStatus !== 'INVITED') return 'invalid';
  return 'active';
}
