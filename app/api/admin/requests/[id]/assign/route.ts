import { contractNotImplemented } from '@/lib/api/not-implemented';

export function PATCH() {
  return contractNotImplemented({
    module: 'admin-crm',
    method: 'PATCH',
    path: '/api/admin/requests/[id]/assign',
    auth: 'manager-or-admin',
    summary: 'Assign a manager user to a request.',
    request: '{ assignedManagerId: string | null }',
    response: 'RequestDetail'
  });
}
