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
