import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { validateSessionAgainstCurrentUser } from '@/lib/auth/current-user-access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { vehicleAccessWhereForClient } from '@/lib/vehicles/ownership';

export type ClientAccessContext = {
  userId: string;
  clientProfileId: string;
  companyId: string | null;
  companyName: string | null;
  mode: 'PERSONAL' | 'COMPANY';
};

export async function requireClientSession() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?error=session-expired');
  }

  const validation = await validateSessionAgainstCurrentUser(session);

  if (!validation.ok) {
    redirect('/login?error=session-expired');
  }

  if (validation.user.role !== 'CLIENT') {
    redirect('/login');
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

export async function getClientProfileForSession(userId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return prisma.clientProfile.findUnique({
    where: { userId },
    include: { user: true }
  });
}

export async function getClientAccessContext(userId: string): Promise<ClientAccessContext | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    include: {
      user: {
        include: {
          companyMemberships: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            include: { company: { select: { id: true, name: true } } }
          }
        }
      }
    }
  });

  if (!profile) {
    return null;
  }

  const membership = profile.user.companyMemberships[0];

  return {
    userId,
    clientProfileId: profile.id,
    companyId: membership?.companyId ?? null,
    companyName: membership?.company.name ?? null,
    mode: membership ? 'COMPANY' : 'PERSONAL'
  };
}

export function requestAccessWhere(context: ClientAccessContext): Prisma.RequestWhereInput {
  if (context.companyId) {
    return {
      OR: [
        { companyId: context.companyId },
        { clientId: context.clientProfileId, companyId: null }
      ]
    };
  }

  return { clientId: context.clientProfileId };
}

export function vehicleAccessWhere(context: ClientAccessContext): Prisma.VehicleWhereInput {
  return vehicleAccessWhereForClient(context);
}

export function documentAccessWhere(context: ClientAccessContext): Prisma.DocumentWhereInput {
  if (context.companyId) {
    return {
      OR: [
        { companyId: context.companyId, clientId: null, vehicleId: null, requestId: null },
        { clientId: context.clientProfileId, companyId: null, vehicleId: null, requestId: null },
        { requestId: { not: null }, clientId: null, companyId: null, vehicleId: null, request: { companyId: context.companyId } },
        { requestId: { not: null }, clientId: null, companyId: null, vehicleId: null, request: { clientId: context.clientProfileId, companyId: null } },
        { vehicleId: { not: null }, clientId: null, companyId: null, requestId: null, vehicle: { companyId: context.companyId } },
        { vehicleId: { not: null }, clientId: null, companyId: null, requestId: null, vehicle: { clientId: context.clientProfileId, companyId: null } }
      ]
    };
  }

  return {
    OR: [
      { clientId: context.clientProfileId, companyId: null, vehicleId: null, requestId: null },
      { requestId: { not: null }, clientId: null, companyId: null, vehicleId: null, request: { clientId: context.clientProfileId } },
      { vehicleId: { not: null }, clientId: null, companyId: null, requestId: null, vehicle: { clientId: context.clientProfileId, companyId: null } }
    ]
  };
}

export async function getClientApiSession() {
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

  if (validation.user.role !== 'CLIENT') {
    return { ok: false as const, status: 'forbidden' as const, statusCode: 403 };
  }

  const validatedSession = {
    ...session,
    user: {
      ...session.user,
      id: validation.user.id,
      role: validation.user.role,
      status: validation.user.status
    }
  };

  const profile = await getClientProfileForSession(validation.user.id);

  if (!profile) {
    return { ok: false as const, status: 'client_profile_not_found' as const, statusCode: 404 };
  }

  const access = await getClientAccessContext(validation.user.id);

  if (!access) {
    return { ok: false as const, status: 'client_profile_not_found' as const, statusCode: 404 };
  }

  return { ok: true as const, session: validatedSession, profile, access };
}

export function clientAccessError(result: { status: string; statusCode: number }) {
  return Response.json({ status: result.status }, { status: result.statusCode });
}
