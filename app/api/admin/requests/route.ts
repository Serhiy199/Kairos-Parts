import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'admin-crm',
    method: 'GET',
    path: '/api/admin/requests',
    auth: 'manager-or-admin',
    summary: 'List CRM requests with filters for status, source, assigned manager, category, and date range.',
    response: '{ items: RequestListItem[], pagination: { page: number, pageSize: number, total: number } }'
  });
}
