import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'requests',
    method: 'GET',
    path: '/api/requests/[id]',
    auth: 'manager-or-admin',
    summary: 'Read a full request detail for CRM workflows.',
    response: 'RequestDetail with files, documents, statusHistory, OCR results, comments'
  });
}

export function PATCH() {
  return contractNotImplemented({
    module: 'requests',
    method: 'PATCH',
    path: '/api/requests/[id]',
    auth: 'manager-or-admin',
    summary: 'Update editable request fields after manager review.',
    request: 'Partial<RequestDetail>',
    response: 'RequestDetail'
  });
}
