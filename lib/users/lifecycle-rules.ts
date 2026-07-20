import type { UserRole, UserStatus } from '@prisma/client';

const ALLOWED_STATUS_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  INVITED: ['ACTIVE'],
  ACTIVE: ['DISABLED'],
  DISABLED: ['ACTIVE']
};

export class InvalidUserStatusTransitionError extends Error {
  constructor(from: UserStatus, to: UserStatus) {
    super(`User status transition ${from} -> ${to} is not allowed.`);
    this.name = 'InvalidUserStatusTransitionError';
  }
}

export class LastActiveAdminError extends Error {
  constructor() {
    super('The last active administrator cannot be disabled or demoted.');
    this.name = 'LastActiveAdminError';
  }
}

export function assertUserStatusTransition(from: UserStatus, to: UserStatus) {
  if (!ALLOWED_STATUS_TRANSITIONS[from].includes(to)) {
    throw new InvalidUserStatusTransitionError(from, to);
  }
}

export function assertActiveAdminWillRemain(input: {
  targetRole: UserRole;
  targetStatus: UserStatus;
  activeAdminCount: number;
}) {
  if (input.targetRole === 'ADMIN' && input.targetStatus === 'ACTIVE' && input.activeAdminCount <= 1) {
    throw new LastActiveAdminError();
  }
}

export const AUTH_VERSION_INCREMENT = { authVersion: { increment: 1 } } as const;
