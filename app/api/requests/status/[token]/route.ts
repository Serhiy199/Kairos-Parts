import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'requests',
    method: 'GET',
    path: '/api/requests/status/[token]',
    auth: 'public',
    summary: 'Read a limited public request status by publicStatusToken without exposing CRM-only data.',
    response: '{ requestNumber: string, status: RequestStatus, statusHistory: public-safe history }',
    notes: ['Token must be unique, unguessable, and separate from request id.']
  });
}
