import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
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
