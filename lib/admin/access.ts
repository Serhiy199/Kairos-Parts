import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { validateSessionAgainstCurrentUser } from '@/lib/auth/current-user-access';
import type { UserRole } from '@/lib/auth/roles';
import { hasDatabaseUrl } from '@/lib/env/database';

const CRM_ROLES: UserRole[] = ['MANAGER', 'ADMIN'];

export async function requireCrmSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/admin/login?error=session-expired&next=/admin');
  }

  const validation = await validateSessionAgainstCurrentUser(session);

  if (!validation.ok) {
    redirect('/admin/login?error=session-expired&next=/admin');
  }

  if (!CRM_ROLES.includes(validation.user.role)) {
    redirect('/');
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: validation.user.id,
      role: validation.user.role,
      status: validation.user.status
    }
  };
}

export async function requireAdminSession() {
  const session = await requireCrmSession();

  if (session.user.role !== 'ADMIN') {
    redirect('/admin');
  }

  return session;
}

export async function getCrmApiSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false as const, status: 'unauthorized' as const, statusCode: 401 };
  }

  if (!hasDatabaseUrl()) {
    return { ok: false as const, status: 'database_not_configured' as const, statusCode: 503 };
  }

  const validation = await validateSessionAgainstCurrentUser(session);

  if (!validation.ok) {
    return { ok: false as const, status: 'unauthorized' as const, statusCode: 401 };
  }

  if (!CRM_ROLES.includes(validation.user.role)) {
    return { ok: false as const, status: 'forbidden' as const, statusCode: 403 };
  }

  return {
    ok: true as const,
    session: {
      ...session,
      user: {
        ...session.user,
        id: validation.user.id,
        role: validation.user.role,
        status: validation.user.status
      }
    }
  };
}

export async function getAdminApiSession() {
  const result = await getCrmApiSession();

  if (!result.ok) {
    return result;
  }

  if (result.session.user.role !== 'ADMIN') {
    return { ok: false as const, status: 'admin_only' as const, statusCode: 403 };
  }

  return result;
}

export function crmAccessError(result: { status: string; statusCode: number }) {
  return Response.json({ status: result.status }, { status: result.statusCode });
}
