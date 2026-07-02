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
    path: '/api/admin/categories',
    auth: 'admin',
    summary: 'Create a category for public website and CRM classification.',
    request: '{ name: string, slug: string, description?: string }',
    response: 'CategorySummary'
  });
}
