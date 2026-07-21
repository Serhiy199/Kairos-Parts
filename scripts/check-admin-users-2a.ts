import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  canAuthenticateWithCredentials,
  validateCurrentSessionState,
  type CurrentAuthenticatedUserState
} from '@/lib/auth/session-state';
import {
  assertActiveAdminWillRemain,
  assertUserStatusTransition,
  AUTH_VERSION_INCREMENT,
  InvalidUserStatusTransitionError,
  LastActiveAdminError
} from '@/lib/users/lifecycle-rules';

const activeManager: CurrentAuthenticatedUserState = {
  id: 'manager-1',
  role: 'MANAGER',
  status: 'ACTIVE',
  authVersion: 1
};

function claims(overrides: Partial<CurrentAuthenticatedUserState> = {}) {
  const value = { ...activeManager, ...overrides };
  return {
    userId: value.id,
    role: value.role,
    status: value.status,
    authVersion: value.authVersion
  };
}

assert.equal(canAuthenticateWithCredentials({ status: 'ACTIVE', hasPassword: true }), true);
assert.equal(canAuthenticateWithCredentials({ status: 'INVITED', hasPassword: true }), false);
assert.equal(canAuthenticateWithCredentials({ status: 'DISABLED', hasPassword: true }), false);
assert.equal(canAuthenticateWithCredentials({ status: 'ACTIVE', hasPassword: false }), false);

assert.equal(validateCurrentSessionState(claims(), activeManager).ok, true);
assert.deepEqual(validateCurrentSessionState(claims({ authVersion: 1 }), { ...activeManager, authVersion: 2 }), {
  ok: false,
  reason: 'auth_version_mismatch'
});
assert.deepEqual(validateCurrentSessionState(claims(), { ...activeManager, role: 'CLIENT' }), {
  ok: false,
  reason: 'role_mismatch'
});
assert.deepEqual(validateCurrentSessionState(claims({ role: 'ADMIN' }), activeManager), {
  ok: false,
  reason: 'role_mismatch'
});
assert.deepEqual(validateCurrentSessionState(claims({ status: 'INVITED' }), activeManager), {
  ok: false,
  reason: 'status_mismatch'
});
assert.deepEqual(validateCurrentSessionState(claims(), { ...activeManager, status: 'DISABLED' }), {
  ok: false,
  reason: 'inactive_user'
});
const activeClient: CurrentAuthenticatedUserState = {
  id: 'client-1',
  role: 'CLIENT',
  status: 'ACTIVE',
  authVersion: 1
};
assert.equal(
  validateCurrentSessionState(
    { userId: activeClient.id, role: activeClient.role, status: activeClient.status, authVersion: 1 },
    activeClient
  ).ok,
  true
);
assert.equal(
  validateCurrentSessionState(
    { userId: activeClient.id, role: activeClient.role, status: activeClient.status, authVersion: 1 },
    { ...activeClient, status: 'DISABLED' }
  ).ok,
  false
);
assert.deepEqual(validateCurrentSessionState(claims(), null), { ok: false, reason: 'missing_user' });
assert.deepEqual(validateCurrentSessionState({ userId: activeManager.id, role: 'MANAGER', status: 'ACTIVE' }, activeManager), {
  ok: false,
  reason: 'legacy_token'
});

assert.doesNotThrow(() => assertUserStatusTransition('INVITED', 'ACTIVE'));
assert.doesNotThrow(() => assertUserStatusTransition('ACTIVE', 'DISABLED'));
assert.doesNotThrow(() => assertUserStatusTransition('DISABLED', 'ACTIVE'));
assert.throws(() => assertUserStatusTransition('INVITED', 'DISABLED'), InvalidUserStatusTransitionError);

assert.throws(
  () => assertActiveAdminWillRemain({ targetRole: 'ADMIN', targetStatus: 'DISABLED', activeAdminCount: 1 }),
  LastActiveAdminError
);
assert.doesNotThrow(() =>
  assertActiveAdminWillRemain({ targetRole: 'ADMIN', targetStatus: 'DISABLED', activeAdminCount: 2 })
);
assert.doesNotThrow(() =>
  assertActiveAdminWillRemain({ targetRole: 'MANAGER', targetStatus: 'ACTIVE', activeAdminCount: 1 })
);
assert.deepEqual(AUTH_VERSION_INCREMENT, { authVersion: { increment: 1 } });

const registration = read('app/(auth)/actions.ts');
assert.match(registration, /role:\s*'CLIENT'/);
assert.match(registration, /status:\s*'ACTIVE'/);
assert.doesNotMatch(registration, /readString\(formData,\s*['"](?:role|status|authVersion)['"]\)/);

const authConfig = read('lib/auth/config.ts');
assert.match(authConfig, /status:\s*true/);
assert.match(authConfig, /authVersion:\s*true/);
assert.match(authConfig, /validateJwtClaimsAgainstCurrentUser/);
assert.doesNotMatch(authConfig, /session\.user\.authVersion\s*=/);

const lifecycle = read('lib/users/lifecycle.ts');
assert.match(lifecycle, /incrementUserAuthVersion/);
assert.match(lifecycle, /assertCanDisableOrDemoteAdmin/);

for (const protectedClientRoute of [
  'app/api/requests/route.ts',
  'app/api/client/vehicles/route.ts',
  'app/api/client/vehicles/[id]/route.ts',
  'app/api/client/documents/route.ts',
  'app/api/client/request-documents/[documentId]/file/route.ts'
]) {
  assert.match(read(protectedClientRoute), /getClientApiSession/);
}

const middleware = read('middleware.ts');
assert.doesNotMatch(middleware, /prisma|current-user-access|DATABASE_URL/);
assert.match(middleware, /hasCurrentLifecycleClaims/);
assert.match(middleware, /Number\.isInteger\(token\.authVersion\)/);

console.log('Stage Admin Users 2A targeted checks passed.');

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
