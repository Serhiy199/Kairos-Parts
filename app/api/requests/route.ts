import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'requests',
    method: 'GET',
    path: '/api/requests',
    auth: 'manager-or-admin',
    summary: 'List requests for CRM-level workflows with future filters by status, source, manager, and date range.',
    response: { items: 'RequestListItem[]', pagination: '{ page, pageSize, total }' }
  });
}

export function POST() {
  return contractNotImplemented({
    module: 'requests',
    method: 'POST',
    path: '/api/requests',
    auth: 'guest-or-client',
    summary: 'Create a website, Telegram, manager-entered, or client dashboard request.',
    request: 'CreateGuestRequestInput | CreateClientRequestInput',
    response: 'RequestDetail',
    notes: ['Guest requests must store guest contact data and publicStatusToken.', 'Client requests must be linked to ClientProfile.']
  });
}
