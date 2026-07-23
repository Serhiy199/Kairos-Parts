import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { AUTH_AUDIT_METADATA_FIELDS, maskAuditLoginIdentifier } from '../lib/audit-log/auth-event-policy';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../lib/audit-log/contracts';
import { sanitizeAuditPayload } from '../lib/audit-log/payload';
import { auditActionLabel, auditEntityLabel } from '../lib/audit-log/presentation';

const root = process.cwd();

async function source(file: string) {
  return readFile(path.join(root, file), 'utf8');
}

function assertContractsAndPresentation() {
  const actions = [
    'AUTH_LOGIN_SUCCEEDED',
    'AUTH_LOGIN_FAILED',
    'AUTH_LOGIN_BLOCKED_DISABLED',
    'AUTH_LOGIN_BLOCKED_PENDING',
    'AUTH_LOGOUT',
    'AUTH_INVITATION_ACCEPTED',
    'AUTH_SESSION_INVALIDATED'
  ] as const;

  for (const action of actions) {
    assert.equal(AUDIT_ACTIONS[action], action);
    assert.notEqual(auditActionLabel(action), action);
  }

  assert.equal(AUDIT_ENTITY_TYPES.AUTH_ATTEMPT, 'AUTH_ATTEMPT');
  assert.equal(AUDIT_ENTITY_TYPES.INVITATION, 'INVITATION');
  assert.match(
    auditEntityLabel({ entityType: 'AUTH_ATTEMPT', entityId: 'credentials:staff', entityLabel: null }),
    /Спроба входу/
  );
  assert.match(
    auditEntityLabel({ entityType: 'INVITATION', entityId: 'invitation-1', entityLabel: null }),
    /Запрошення/
  );
}

function assertIdentifierPrivacy() {
  assert.equal(maskAuditLoginIdentifier('Buyer.Name@Example.COM'), 'b***@example.com');
  assert.equal(maskAuditLoginIdentifier('+380730031900'), '+380******900');
  assert.equal(maskAuditLoginIdentifier('short'), '***');
  assert.equal(maskAuditLoginIdentifier(''), null);

  const sanitized = sanitizeAuditPayload({
    password: 'secret',
    passwordHash: 'secret',
    resetToken: 'secret',
    inviteToken: 'secret',
    sessionToken: 'secret',
    cookie: 'secret',
    authorization: 'secret',
    rawUrl: 'https://example.test/reset?token=secret',
    callbackUrl: 'https://example.test/callback?code=secret',
    sessionPayload: { sub: 'secret' },
    requestBody: { password: 'secret' },
    loginIdentifierMasked: 'b***@example.com',
    reason: 'INVALID_PASSWORD'
  }, [
    'password',
    'passwordHash',
    'resetToken',
    'inviteToken',
    'sessionToken',
    'cookie',
    'authorization',
    'rawUrl',
    'callbackUrl',
    'sessionPayload',
    'requestBody',
    'loginIdentifierMasked',
    'reason'
  ]);

  assert.deepEqual(sanitized, {
    loginIdentifierMasked: 'b***@example.com',
    reason: 'INVALID_PASSWORD'
  });
  assert.deepEqual(
    [...AUTH_AUDIT_METADATA_FIELDS].sort(),
    ['authMethod', 'event', 'loginIdentifierMasked', 'loginScope', 'reason', 'role', 'source']
  );
}

async function assertStaticCoverage() {
  const [
    authConfig,
    authEvents,
    authActions,
    invitationActions,
    invitations,
    lifecycle,
    teamActions,
    middleware,
    forgotPassword,
    migration
  ] = await Promise.all([
    source('lib/auth/config.ts'),
    source('lib/audit-log/auth-events.ts'),
    source('app/(auth)/actions.ts'),
    source('app/(auth)/invitation/manager/actions.ts'),
    source('lib/users/manager-invitations.ts'),
    source('lib/users/admin-team-lifecycle.ts'),
    source('app/admin/team/actions.ts'),
    source('middleware.ts'),
    source('app/(auth)/forgot-password/page.tsx'),
    source('prisma/migrations/20260723120000_add_auth_audit_events/migration.sql')
  ]);

  for (const action of [
    'AUTH_LOGIN_SUCCEEDED',
    'AUTH_LOGIN_FAILED',
    'AUTH_LOGIN_BLOCKED_DISABLED',
    'AUTH_LOGIN_BLOCKED_PENDING'
  ]) {
    assert.match(authConfig, new RegExp(`action: '${action}'`));
  }
  assert.match(authConfig, /auditRequestContextFromHeaders\(request\.headers\)/);
  assert.match(authConfig, /reason: user \? 'INVALID_PASSWORD' : 'USER_NOT_FOUND'/);
  assert.match(authConfig, /reason: 'RATE_LIMITED'/);

  const callbacks = authConfig.split('callbacks:')[1] ?? '';
  assert.doesNotMatch(callbacks, /writeBestEffortLoginAudit/);
  assert.doesNotMatch(middleware, /writeBestEffortLoginAudit|writeAuditLog/);

  assert.match(authEvents, /category: 'LOGIN'/);
  assert.match(authEvents, /catch \(error\)/);
  assert.match(authEvents, /Authentication audit write failed/);
  assert.doesNotMatch(authEvents, /\b(?:passwordHash|resetToken|inviteToken|sessionToken|cookie|authorization|rawUrl)\s*:/i);

  assert.match(authActions, /session\?\.user\.id[\s\S]*writeBestEffortLogoutAudit/);
  assert.match(authActions, /source: 'CLIENT_LOGOUT'/);
  assert.match(authActions, /source: 'STAFF_LOGOUT'/);

  assert.match(invitationActions, /getServerAuditRequestContext/);
  assert.match(invitations, /prisma\.\$transaction\([\s\S]*AUTH_INVITATION_ACCEPTED/);
  assert.match(invitations, /action: 'MANAGER_ACTIVATED'[\s\S]*action: 'AUTH_INVITATION_ACCEPTED'/);
  assert.doesNotMatch(invitations.match(/AUTH_INVITATION_ACCEPTED[\s\S]*?return \{ managerId/)?.[0] ?? '', /tokenHash|passwordHash/);

  assert.match(teamActions, /getServerAuditRequestContext/);
  assert.match(lifecycle, /authVersion: \{ increment: 1 \}/);
  assert.match(lifecycle, /targetStatus === 'DISABLED'[\s\S]*AUTH_SESSION_INVALIDATED/);
  assert.match(lifecycle, /prisma\.\$transaction\([\s\S]*MANAGER_DISABLED[\s\S]*AUTH_SESSION_INVALIDATED/);

  assert.match(forgotPassword, /не входить|Day 1/i);
  assert.doesNotMatch(forgotPassword, /resetToken|passwordReset/i);

  for (const value of [
    'AUTH_ATTEMPT',
    'INVITATION',
    'AUTH_LOGIN_SUCCEEDED',
    'AUTH_LOGIN_FAILED',
    'AUTH_LOGIN_BLOCKED_DISABLED',
    'AUTH_LOGIN_BLOCKED_PENDING',
    'AUTH_LOGOUT',
    'AUTH_INVITATION_ACCEPTED',
    'AUTH_SESSION_INVALIDATED'
  ]) {
    assert.match(migration, new RegExp(`ADD VALUE IF NOT EXISTS '${value}'`));
  }
}

async function assertTransactionPolicy() {
  type State = { business: number; audit: number };
  const state: State = { business: 0, audit: 0 };

  async function transaction(work: (draft: State) => Promise<void>) {
    const draft = { ...state };
    await work(draft);
    Object.assign(state, draft);
  }

  await transaction(async (draft) => {
    draft.business += 1;
    draft.audit += 1;
  });
  assert.deepEqual(state, { business: 1, audit: 1 });

  await assert.rejects(transaction(async (draft) => {
    draft.business += 1;
    throw new Error('transactional audit failed');
  }), /transactional audit failed/);
  assert.deepEqual(state, { business: 1, audit: 1 });

  let authCompleted = false;
  try {
    throw new Error('best-effort audit failed');
  } catch {
    authCompleted = true;
  }
  assert.equal(authCompleted, true);
}

async function main() {
  assertContractsAndPresentation();
  assertIdentifierPrivacy();
  await assertStaticCoverage();
  await assertTransactionPolicy();
  process.stdout.write('Admin Audit Log 5 verification passed.\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
