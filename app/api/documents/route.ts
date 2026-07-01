import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'documents',
    method: 'GET',
    path: '/api/documents',
    auth: 'client',
    summary: 'Legacy reserved documents endpoint. Prefer /api/client/documents.',
    response: 'StoredFileContract[]'
  });
}

export function POST() {
  return contractNotImplemented({
    module: 'documents',
    method: 'POST',
    path: '/api/documents',
    auth: 'client',
    summary: 'Reserved document upload metadata endpoint. Actual upload flow is not implemented on Day 2.',
    request: 'multipart/form-data or storage metadata',
    response: 'StoredFileContract'
  });
}
