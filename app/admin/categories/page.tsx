import { notFound, redirect } from 'next/navigation';

import { EQUIPMENT_TAXONOMY_ADMIN_ENABLED } from '@/lib/features/equipment-taxonomy';

export default async function AdminCategoriesPage() {
  if (!EQUIPMENT_TAXONOMY_ADMIN_ENABLED) {
    notFound();
  }

  redirect('/admin/directories');
}
