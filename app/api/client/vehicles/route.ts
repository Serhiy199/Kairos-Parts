import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'client-vehicles',
    method: 'GET',
    path: '/api/client/vehicles',
    auth: 'client',
    summary: 'List vehicles for the authenticated client profile.',
    response: 'VehicleSummary[]'
  });
}

export function POST() {
  return contractNotImplemented({
    module: 'client-vehicles',
    method: 'POST',
    path: '/api/client/vehicles',
    auth: 'client',
    summary: 'Create a vehicle for the authenticated client profile.',
    request: '{ type: string, manufacturer: string, model: string, year?: number, vinOrSerial?: string, comment?: string }',
    response: 'VehicleSummary'
  });
}
