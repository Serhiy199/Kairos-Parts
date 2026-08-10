'use server';

import { auth, signOut } from '@/auth';
import { writeBestEffortLogoutAudit } from '@/lib/audit-log/auth-events';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { updateOwnClientProfile, type ClientProfileUpdateResult } from '@/lib/client-profile/service';
import { requireClientSession } from '@/lib/client/access';

export async function updateClientProfileAction(formData: FormData): Promise<ClientProfileUpdateResult> {
  const [session, requestContext] = await Promise.all([
    requireClientSession(),
    getServerAuditRequestContext()
  ]);

  return updateOwnClientProfile({
    userId: session.user.id,
    formData,
    requestContext
  });
}

export async function updateClientProfileUiAction(
  formData: FormData
): Promise<ClientProfileUpdateResult> {
  const result = await updateClientProfileAction(formData);

  if (result.ok && result.requiresReauthentication) {
    const [session, requestContext] = await Promise.all([
      auth(),
      getServerAuditRequestContext()
    ]);

    if (session?.user.id && session.user.role === 'CLIENT') {
      await writeBestEffortLogoutAudit({
        userId: session.user.id,
        role: session.user.role,
        source: 'CLIENT_LOGOUT',
        requestContext
      });
    }

    await signOut({ redirectTo: '/login?profile-updated=1' });
  }

  return result;
}
