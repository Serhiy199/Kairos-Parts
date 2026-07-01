import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'admin-crm',
    method: 'GET',
    path: '/api/admin/requests/[id]',
    auth: 'manager-or-admin',
    summary: 'Read full CRM request detail including files, documents, vehicle, OCR results, comments, and history.',
    response: 'RequestDetail with CRM relations'
  });
}
