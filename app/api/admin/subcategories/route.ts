import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
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
