import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export async function requireClientSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.role !== 'CLIENT') {
    redirect('/login');
  }

  return session;
}

export async function getClientProfileForSession(userId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return prisma.clientProfile.findUnique({
    where: { userId },
    include: { user: true }
  });
}

export async function getClientApiSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false as const, status: 'unauthorized' as const, statusCode: 401 };
  }

  if (session.user.role !== 'CLIENT') {
    return { ok: false as const, status: 'forbidden' as const, statusCode: 403 };
  }

  if (!hasDatabaseUrl()) {
    return { ok: false as const, status: 'database_not_configured' as const, statusCode: 503 };
  }

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    return { ok: false as const, status: 'client_profile_not_found' as const, statusCode: 404 };
  }

  return { ok: true as const, session, profile };
}

export function clientAccessError(result: { status: string; statusCode: number }) {
  return Response.json({ status: result.status }, { status: result.statusCode });
}
