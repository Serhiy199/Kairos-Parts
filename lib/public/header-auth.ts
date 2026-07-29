import 'server-only';

import type { UserRole } from '@prisma/client';

import { auth } from '@/auth';
import { validateSessionAgainstCurrentUser } from '@/lib/auth/current-user-access';

export type PublicHeaderCta =
  | {
      href: '/login';
      label: 'Увійти';
      icon: 'login';
      state: 'guest';
    }
  | {
      href: '/client' | '/admin';
      label: 'До кабінету';
      icon: 'dashboard';
      state: 'authenticated';
    };

const GUEST_HEADER_CTA: PublicHeaderCta = {
  href: '/login',
  label: 'Увійти',
  icon: 'login',
  state: 'guest'
};

const CABINET_HREF_BY_ROLE: Partial<Record<UserRole, '/client' | '/admin'>> = {
  CLIENT: '/client',
  MANAGER: '/admin',
  ADMIN: '/admin'
};

export async function getPublicHeaderCta(): Promise<PublicHeaderCta> {
  const session = await auth();
  if (!session?.user?.id) return GUEST_HEADER_CTA;

  try {
    const validation = await validateSessionAgainstCurrentUser(session);
    if (!validation.ok) return GUEST_HEADER_CTA;

    const href = CABINET_HREF_BY_ROLE[validation.user.role];
    if (!href) return GUEST_HEADER_CTA;

    return {
      href,
      label: 'До кабінету',
      icon: 'dashboard',
      state: 'authenticated'
    };
  } catch {
    return GUEST_HEADER_CTA;
  }
}
