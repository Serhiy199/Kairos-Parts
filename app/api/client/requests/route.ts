import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'client-dashboard',
    method: 'GET',
    path: '/api/client/requests',
    auth: 'client',
    summary: 'List requests owned by the authenticated client profile.',
    response: 'RequestListItem[]',
    notes: ['Client ownership must come from session.user, not from a frontend-supplied userId.']
  });
}
