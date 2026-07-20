'use server';

import { redirect } from 'next/navigation';

import {
  activateManagerInvitation,
  ManagerInvitationError
} from '@/lib/users/manager-invitations';
import {
  isValidManagerPassword,
  MANAGER_PASSWORD_MAX_LENGTH,
  MANAGER_PASSWORD_MIN_LENGTH
} from '@/lib/users/manager-invitation-rules';

export type ManagerPasswordSetupState = {
  status: 'idle' | 'error';
  message: string;
};

export const INITIAL_MANAGER_PASSWORD_SETUP_STATE: ManagerPasswordSetupState = {
  status: 'idle',
  message: ''
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function setManagerPassword(
  _previousState: ManagerPasswordSetupState,
  formData: FormData
): Promise<ManagerPasswordSetupState> {
  const token = readString(formData, 'token');
  const password = readString(formData, 'password');
  const confirmPassword = readString(formData, 'confirmPassword');

  if (!token || !password || !confirmPassword) {
    return { status: 'error', message: 'Заповніть обидва поля пароля.' };
  }

  if (!isValidManagerPassword(password)) {
    return {
      status: 'error',
      message: `Пароль має містити від ${MANAGER_PASSWORD_MIN_LENGTH} до ${MANAGER_PASSWORD_MAX_LENGTH} символів.`
    };
  }

  if (password !== confirmPassword) {
    return { status: 'error', message: 'Паролі не збігаються.' };
  }

  try {
    await activateManagerInvitation({ token, password });
  } catch (error) {
    if (error instanceof ManagerInvitationError) {
      return {
        status: 'error',
        message: 'Посилання вже використане або більше не активне. Зверніться до адміністратора.'
      };
    }

    return {
      status: 'error',
      message: 'Не вдалося активувати акаунт. Спробуйте ще раз.'
    };
  }

  redirect('/invitation/manager/complete');
}
