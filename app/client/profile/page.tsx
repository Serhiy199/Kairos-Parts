import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { ClientProfileEditor } from '@/components/client/client-profile-editor';
import { getClientAccessContext, getClientProfileForSession, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';

export const dynamic = 'force-dynamic';

export default async function ClientProfilePage() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const [profile, access] = await Promise.all([
    getClientProfileForSession(session.user.id),
    getClientAccessContext(session.user.id)
  ]);

  if (!profile || !access) {
    return <ClientDbBlocker />;
  }

  return (
    <ClientProfileEditor
      key={profile.updatedAt.toISOString()}
      profile={{
        clientType: profile.clientType,
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        companyName: access.companyName ?? profile.companyName ?? '',
        taxId: access.companyEdrpou ?? profile.taxId ?? '',
        contactName: profile.contactName ?? profile.user.name ?? '',
        email: profile.user.email ?? profile.email ?? '',
        phone: profile.user.normalizedPhone ?? profile.user.phone ?? profile.phone ?? '',
        companyFieldsEditable: access.mode === 'PERSONAL' || access.isPrimaryContact,
        createdAtLabel: profile.createdAt.toLocaleDateString('uk-UA')
      }}
    />
  );
}
