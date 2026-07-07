import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import type { UserRole } from '@/lib/auth/roles';
import { hasDatabaseUrl } from '@/lib/env/database';

const CRM_ROLES: UserRole[] = ['MANAGER', 'ADMIN'];

export async function requireCrmSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/admin/login?next=/admin');
  }

  if (!session.user.role || !CRM_ROLES.includes(session.user.role)) {
    redirect('/');
  }

  return session;
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

  if (!session.user.role || !CRM_ROLES.includes(session.user.role)) {
    return { ok: false as const, status: 'forbidden' as const, statusCode: 403 };
  }

  if (!hasDatabaseUrl()) {
    return { ok: false as const, status: 'database_not_configured' as const, statusCode: 503 };
  }

  return { ok: true as const, session };
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
