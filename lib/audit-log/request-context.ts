import { headers } from 'next/headers';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';

type HeaderReader = Pick<Headers, 'get'>;

export function auditRequestContextFromHeaders(requestHeaders: HeaderReader): AuditRequestContext {
  return {
    ipAddress: requestHeaders.get('x-forwarded-for') ?? requestHeaders.get('x-real-ip'),
    userAgent: requestHeaders.get('user-agent')
  };
}

export async function getServerAuditRequestContext(): Promise<AuditRequestContext> {
  return auditRequestContextFromHeaders(await headers());
}
