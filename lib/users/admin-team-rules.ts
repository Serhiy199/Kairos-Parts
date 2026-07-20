import type { UserRole, UserStatus } from '@prisma/client';

export type ManagerAccessTargetStatus = Extract<UserStatus, 'ACTIVE' | 'DISABLED'>;

type ManagerLifecycleErrorCode =
  | 'manager_not_found'
  | 'invalid_target'
  | 'invalid_transition'
  | 'password_missing';

export class ManagerLifecycleError extends Error {
  constructor(
    public readonly code: ManagerLifecycleErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ManagerLifecycleError';
  }
}

export function assertManagerLifecycleTransition(input: {
  exists: boolean;
  role?: UserRole;
  status?: UserStatus;
  hasPassword?: boolean;
  targetStatus: ManagerAccessTargetStatus;
}) {
  if (!input.exists) {
    throw new ManagerLifecycleError('manager_not_found', 'Менеджера не знайдено.');
  }

  if (input.role !== 'MANAGER') {
    throw new ManagerLifecycleError('invalid_target', 'Дія недоступна для цього користувача.');
  }

  const expectedStatus = input.targetStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';

  if (input.status !== expectedStatus) {
    throw new ManagerLifecycleError('invalid_transition', 'Дія недоступна для поточного статусу менеджера.');
  }

  if (input.targetStatus === 'ACTIVE' && !input.hasPassword) {
    throw new ManagerLifecycleError(
      'password_missing',
      'Менеджер не має встановленого пароля. Потрібно створити нове запрошення.'
    );
  }
}

export const TEAM_ROLE_LABELS: Record<Extract<UserRole, 'ADMIN' | 'MANAGER'>, string> = {
  ADMIN: 'Адміністратор',
  MANAGER: 'Менеджер'
};

export const TEAM_STATUS_LABELS: Record<UserStatus, string> = {
  INVITED: 'Очікує активації',
  ACTIVE: 'Активний',
  DISABLED: 'Вимкнений'
};
