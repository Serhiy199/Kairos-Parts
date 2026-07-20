import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireAdminSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getAdminTeamMembers } from '@/lib/users/admin-team-queries';
import { TeamManagement } from './team-management';

export const dynamic = 'force-dynamic';

export default async function AdminTeamPage() {
  await requireAdminSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const members = await getAdminTeamMembers();

  return <TeamManagement members={members} />;
}
