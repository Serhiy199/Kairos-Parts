import { contractNotImplemented } from '@/lib/api/not-implemented';

export function GET() {
  return contractNotImplemented({
    module: 'vehicles',
    method: 'GET',
    path: '/api/vehicles',
    auth: 'client',
    summary: 'Legacy reserved client vehicles endpoint. Prefer /api/client/vehicles.',
    response: 'VehicleSummary[]'
  });
}

export function POST() {
  return contractNotImplemented({
    module: 'vehicles',
    method: 'POST',
    path: '/api/vehicles',
    auth: 'client',
    summary: 'Legacy reserved vehicle creation endpoint. Prefer /api/client/vehicles.',
    request: 'VehicleSummary draft',
    response: 'VehicleSummary'
  });
}
