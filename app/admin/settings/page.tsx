import { SkeletonPage } from '@/components/ui/skeleton-page';
import { requireAdminSession } from '@/lib/admin/access';

export default async function AdminSettingsPage() {
  await requireAdminSession();

  return <SkeletonPage title="Налаштування" description="Системні налаштування CRM не входять у Day 1 реалізацію." />;
}
