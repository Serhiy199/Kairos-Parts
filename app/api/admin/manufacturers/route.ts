import { contractNotImplemented } from '@/lib/api/not-implemented';
import { crmAccessError, getAdminApiSession } from '@/lib/admin/access';

export async function POST() {
  const access = await getAdminApiSession();

  if (!access.ok) {
    return crmAccessError(access);
  }

  return contractNotImplemented({
    module: 'catalog',
    method: 'POST',
    path: '/api/admin/manufacturers',
    auth: 'admin',
    summary: 'Create a manufacturer optionally linked to category or subcategory.',
    request: '{ categoryId?: string, subcategoryId?: string, name: string, slug: string }',
    response: 'ManufacturerSummary'
  });
}
