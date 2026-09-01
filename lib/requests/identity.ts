import 'server-only';

import { auth } from '@/auth';
import { validateSessionAgainstCurrentUser } from '@/lib/auth/current-user-access';
import { getClientAccessContext, type ClientAccessContext } from '@/lib/client/access';

export type RequestSubmitIdentity =
  | { type: 'GUEST' }
  | { type: 'CLIENT'; userId: string; access: ClientAccessContext };

export type RequestIdentityResolution =
  | { ok: true; identity: RequestSubmitIdentity }
  | {
      ok: false;
      status: 'unauthorized' | 'forbidden' | 'client_profile_not_found';
      statusCode: 401 | 403 | 404;
    };

export async function resolveRequestSubmitIdentity(): Promise<RequestIdentityResolution> {
  const session = await auth();
  if (!session?.user?.id) return { ok: true, identity: { type: 'GUEST' } };

  const validation = await validateSessionAgainstCurrentUser(session);
  if (!validation.ok) {
    return { ok: false, status: 'unauthorized', statusCode: 401 };
  }
  if (validation.user.role !== 'CLIENT') {
    return { ok: false, status: 'forbidden', statusCode: 403 };
  }

  const access = await getClientAccessContext(validation.user.id);
  if (!access) {
    return { ok: false, status: 'client_profile_not_found', statusCode: 404 };
  }

  return {
    ok: true,
    identity: { type: 'CLIENT', userId: validation.user.id, access }
  };
}
