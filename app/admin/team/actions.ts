'use server';

import { revalidatePath } from 'next/cache';

import { requireAdminSession } from '@/lib/admin/access';
import {
  createInvitedManager,
  ManagerInvitationError,
  regenerateManagerInvitation
} from '@/lib/users/manager-invitations';
import { setManagerAccessStatus } from '@/lib/users/admin-team-lifecycle';
import { ManagerLifecycleError } from '@/lib/users/admin-team-rules';
import type { TeamActionResult } from './action-state';

function safeInvitationError(error: unknown, fallback: string): TeamActionResult {
  if (error instanceof ManagerInvitationError) {
    return { status: 'error', message: error.message };
  }

  return { status: 'error', message: fallback };
}

export async function createManagerAction(
  _state: TeamActionResult,
  formData: FormData
): Promise<TeamActionResult> {
  const session = await requireAdminSession();
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');

  try {
    const result = await createInvitedManager({
      name,
      email,
      createdByAdminId: session.user.id
    });

    revalidatePath('/admin/team');

    return {
      status: 'success',
      message: 'Менеджера створено.',
      invitation: {
        url: result.invitationUrl,
        expiresAt: result.expiresAt.toISOString(),
        managerName: result.manager.name || result.manager.email || 'Менеджер'
      }
    };
  } catch (error) {
    return safeInvitationError(error, 'Не вдалося створити менеджера.');
  }
}

export async function regenerateManagerInvitationAction(managerId: string): Promise<TeamActionResult> {
  const session = await requireAdminSession();

  try {
    const result = await regenerateManagerInvitation({
      userId: managerId,
      actorAdminId: session.user.id
    });

    revalidatePath('/admin/team');

    return {
      status: 'success',
      message: 'Нове посилання створено. Старі невикористані посилання відкликано.',
      invitation: {
        url: result.invitationUrl,
        expiresAt: result.expiresAt.toISOString(),
        managerName: result.manager.name || result.manager.email || 'Менеджер'
      }
    };
  } catch (error) {
    return safeInvitationError(error, 'Не вдалося створити нове посилання.');
  }
}

async function updateManagerAccess(
  managerId: string,
  targetStatus: 'ACTIVE' | 'DISABLED'
): Promise<TeamActionResult> {
  const session = await requireAdminSession();

  try {
    await setManagerAccessStatus({
      managerId,
      actorAdminId: session.user.id,
      targetStatus
    });

    revalidatePath('/admin/team');

    return {
      status: 'success',
      message: targetStatus === 'DISABLED'
        ? 'Доступ менеджера вимкнено. Поточні сесії анульовано.'
        : 'Доступ менеджера увімкнено. Менеджер може увійти з поточним паролем.'
    } satisfies TeamActionResult;
  } catch (error) {
    if (error instanceof ManagerLifecycleError) {
      return { status: 'error', message: error.message } satisfies TeamActionResult;
    }

    return {
      status: 'error',
      message: targetStatus === 'DISABLED'
        ? 'Не вдалося вимкнути доступ.'
        : 'Не вдалося увімкнути доступ.'
    } satisfies TeamActionResult;
  }
}

export async function disableManagerAction(managerId: string): Promise<TeamActionResult> {
  return updateManagerAccess(managerId, 'DISABLED');
}

export async function enableManagerAction(managerId: string): Promise<TeamActionResult> {
  return updateManagerAccess(managerId, 'ACTIVE');
}
