import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
  return contractNotImplemented({
    module: 'admin-crm',
    method: 'POST',
    path: '/api/admin/requests/[id]/comments',
    auth: 'manager-or-admin',
    summary: 'Add an internal CRM comment to a request.',
    request: '{ message: string }',
    response: '{ id: string, requestId: string, authorId?: string, message: string, internal: true, createdAt: string }'
  });
}
