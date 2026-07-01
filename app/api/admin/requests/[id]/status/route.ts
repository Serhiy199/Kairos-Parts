import { contractNotImplemented } from '@/lib/api/not-implemented';

export function PATCH() {
  return contractNotImplemented({
    module: 'admin-crm',
    method: 'PATCH',
    path: '/api/admin/requests/[id]/status',
    auth: 'manager-or-admin',
    summary: 'Change request status and append RequestStatusHistory.',
    request: '{ status: RequestStatus }',
    response: '{ request: RequestDetail, historyItem: RequestStatusHistory }'
  });
}
