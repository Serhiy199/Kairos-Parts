import 'server-only';

import { auth } from '@/auth';
import { validateSessionAgainstCurrentUser } from '@/lib/auth/current-user-access';
import { getClientAccessContext } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
import { LogisticsRequestError } from '@/lib/logistics/request-errors';

export type LogisticsSubmitIdentity =
  | {
      type: 'GUEST';
      userId: null;
      clientId: null;
      companyId: null;
    }
  | {
      type: 'CLIENT';
      userId: string;
      clientId: string;
      companyId: string | null;
    };

export const GUEST_LOGISTICS_IDENTITY: LogisticsSubmitIdentity = {
  type: 'GUEST',
  userId: null,
  clientId: null,
  companyId: null
};

export async function resolveLogisticsSubmitIdentity(): Promise<LogisticsSubmitIdentity> {
  const session = await auth();

  if (!session) {
    return GUEST_LOGISTICS_IDENTITY;
  }

  if (!session.user?.id) {
    throw new LogisticsRequestError(
      'INVALID_SESSION',
      401,
      'Сесію завершено. Оновіть сторінку та спробуйте ще раз.'
    );
  }

  const validation = await validateSessionAgainstCurrentUser(session);
  if (!validation.ok) {
    throw new LogisticsRequestError(
      'INVALID_SESSION',
      401,
      'Сесію завершено. Увійдіть повторно.'
    );
  }

  if (validation.user.role === 'ADMIN' || validation.user.role === 'MANAGER') {
    throw new LogisticsRequestError(
      'STAFF_SUBMIT_FORBIDDEN',
      403,
      'Працівники не можуть створювати публічні логістичні заявки.'
    );
  }

  if (validation.user.role !== 'CLIENT') {
    throw new LogisticsRequestError(
      'STAFF_SUBMIT_FORBIDDEN',
      403,
      'Ця дія недоступна для поточної ролі.'
    );
  }

  const access = await getClientAccessContext(validation.user.id);
  if (!access) {
    throw new LogisticsRequestError(
      'INVALID_SESSION',
      401,
      'Не вдалося підтвердити профіль клієнта.'
    );
  }

  return {
    type: 'CLIENT',
    userId: validation.user.id,
    clientId: access.clientProfileId,
    companyId: access.companyId
  };
}
export async function getLogisticsRequestContactPrefill() {
  const empty = { name: '', phone: '' };
  const session = await auth();

  if (!session?.user?.id) {
    return empty;
  }

  const validation = await validateSessionAgainstCurrentUser(session);
  if (!validation.ok || validation.user.role !== 'CLIENT') {
    return empty;
  }

  const profile = await prisma.clientProfile.findUnique({
    where: { userId: validation.user.id },
    select: {
      contactName: true,
      firstName: true,
      lastName: true,
      phone: true,
      user: {
        select: {
          name: true,
          normalizedPhone: true,
          phone: true
        }
      }
    }
  });

  if (!profile) {
    return empty;
  }

  const personalName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const phone = normalizeUkrainianPhone(
    profile.user.normalizedPhone ?? profile.phone ?? profile.user.phone
  );

  return {
    name: profile.contactName?.trim() || personalName || profile.user.name?.trim() || '',
    phone: phone ?? ''
  };
}
