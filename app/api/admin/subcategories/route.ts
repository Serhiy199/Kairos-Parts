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
    path: '/api/admin/subcategories',
    auth: 'admin',
    summary: 'Create a subcategory under a category.',
    request: '{ categoryId: string, name: string, slug: string, description?: string }',
    response: 'SubcategorySummary'
  });
}
