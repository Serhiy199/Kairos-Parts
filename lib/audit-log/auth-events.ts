import 'server-only';

import type { AuditAction, UserRole } from '@prisma/client';

import {
  AUTH_AUDIT_METADATA_FIELDS,
  maskAuditLoginIdentifier
} from '@/lib/audit-log/auth-event-policy';
import {
  auditAnonymousActor,
  auditUserActor,
  type AuditRequestContext
} from '@/lib/audit-log/contracts';
import { writeAuditLog } from '@/lib/audit-log/service';
import { prisma } from '@/lib/prisma';

type LoginScope = 'CLIENT' | 'STAFF';

export async function writeBestEffortLoginAudit(input: {
  action: AuditAction;
  scope: LoginScope;
  identifier: unknown;
  reason: string;
  requestContext: AuditRequestContext;
  user?: { id: string; name: string | null; role: UserRole } | null;
}) {
  try {
    await writeAuditLog(prisma, {
      actor: input.action === 'AUTH_LOGIN_SUCCEEDED' && input.user
        ? auditUserActor(input.user.id)
        : auditAnonymousActor(),
      entityType: input.user ? 'USER' : 'AUTH_ATTEMPT',
      entityId: input.user?.id ?? `credentials:${input.scope.toLowerCase()}`,
      entityLabel: input.user?.name ?? `Credentials ${input.scope}`,
      action: input.action,
      category: 'LOGIN',
      metadata: {
        event: input.action,
        reason: input.reason,
        authMethod: 'PASSWORD',
        loginScope: input.scope,
        loginIdentifierMasked: maskAuditLoginIdentifier(input.identifier),
        role: input.user?.role ?? null,
        source: input.scope === 'STAFF' ? 'STAFF_LOGIN' : 'CLIENT_LOGIN'
      },
      allowedFields: { metadata: AUTH_AUDIT_METADATA_FIELDS },
      requestContext: input.requestContext
    });
  } catch (error) {
    console.error('Authentication audit write failed.', {
      event: input.action,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
  }
}

export async function writeBestEffortLogoutAudit(input: {
  userId: string;
  role: UserRole;
  source: 'CLIENT_LOGOUT' | 'STAFF_LOGOUT';
  requestContext: AuditRequestContext;
}) {
  try {
    await writeAuditLog(prisma, {
      actor: auditUserActor(input.userId),
      entityType: 'AUTH_SESSION',
      entityId: input.userId,
      entityLabel: 'Поточна сесія',
      action: 'AUTH_LOGOUT',
      category: 'LOGIN',
      metadata: {
        event: 'AUTH_LOGOUT',
        reason: 'USER_INITIATED',
        role: input.role,
        source: input.source
      },
      allowedFields: { metadata: AUTH_AUDIT_METADATA_FIELDS },
      requestContext: input.requestContext
    });
  } catch (error) {
    console.error('Authentication audit write failed.', {
      event: 'AUTH_LOGOUT',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
  }
}
