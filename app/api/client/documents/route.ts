import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'client-documents',
    method: 'GET',
    path: '/api/client/documents',
    auth: 'client',
    summary: 'List documents visible to the authenticated client.',
    response: 'StoredFileContract[]',
    notes: ['Documents can be attached to client, request, or vehicle records.']
  });
}
