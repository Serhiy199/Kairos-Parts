import { NextResponse } from 'next/server';

export type ApiContract = {
  module: string;
  method: string;
  path: string;
  auth: 'public' | 'guest-or-client' | 'client' | 'manager' | 'admin' | 'manager-or-admin' | 'system';
  summary: string;
  request?: unknown;
  response?: unknown;
  notes?: string[];
};

export function contractNotImplemented(contract: ApiContract) {
  return NextResponse.json(
    {
      status: 'not_implemented',
      contract
    },
    { status: 501 }
  );
}

export function notImplemented(moduleName: string) {
  return contractNotImplemented({
    module: moduleName,
    method: 'ANY',
    path: 'reserved',
    auth: 'system',
    summary: 'Reserved endpoint placeholder. Replace with a route-specific contract before implementation.'
  });
}
