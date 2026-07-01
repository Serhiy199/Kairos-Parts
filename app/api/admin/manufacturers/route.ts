import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
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
