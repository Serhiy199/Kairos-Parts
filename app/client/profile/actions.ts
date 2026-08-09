'use server';

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
