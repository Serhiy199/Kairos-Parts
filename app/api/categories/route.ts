import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'catalog',
    method: 'GET',
    path: '/api/categories',
    auth: 'public',
    summary: 'List public categories with optional subcategories and manufacturers.',
    response: 'CategorySummary[]'
  });
}
