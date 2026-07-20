import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  assertManagerLifecycleTransition,
  ManagerLifecycleError,
  TEAM_ROLE_LABELS,
  TEAM_STATUS_LABELS
} from '../lib/users/admin-team-rules';
import {
  assertActiveAdminWillRemain,
  assertUserStatusTransition,
  LastActiveAdminError
} from '../lib/users/lifecycle-rules';

function expectLifecycleError(run: () => void, code: ManagerLifecycleError['code']) {
  assert.throws(run, (error) => error instanceof ManagerLifecycleError && error.code === code);
}

async function main() {
  assert.equal(TEAM_ROLE_LABELS.ADMIN, 'Адміністратор');
  assert.equal(TEAM_ROLE_LABELS.MANAGER, 'Менеджер');
  assert.equal(TEAM_STATUS_LABELS.INVITED, 'Очікує активації');
  assert.equal(TEAM_STATUS_LABELS.ACTIVE, 'Активний');
  assert.equal(TEAM_STATUS_LABELS.DISABLED, 'Вимкнений');

  assert.doesNotThrow(() => assertManagerLifecycleTransition({
    exists: true,
    role: 'MANAGER',
    status: 'ACTIVE',
    hasPassword: true,
    targetStatus: 'DISABLED'
  }));
  assert.doesNotThrow(() => assertManagerLifecycleTransition({
    exists: true,
    role: 'MANAGER',
    status: 'DISABLED',
    hasPassword: true,
    targetStatus: 'ACTIVE'
  }));

  expectLifecycleError(() => assertManagerLifecycleTransition({ exists: false, targetStatus: 'DISABLED' }), 'manager_not_found');
  expectLifecycleError(() => assertManagerLifecycleTransition({ exists: true, role: 'ADMIN', status: 'ACTIVE', hasPassword: true, targetStatus: 'DISABLED' }), 'invalid_target');
  expectLifecycleError(() => assertManagerLifecycleTransition({ exists: true, role: 'CLIENT', status: 'ACTIVE', hasPassword: true, targetStatus: 'DISABLED' }), 'invalid_target');
  expectLifecycleError(() => assertManagerLifecycleTransition({ exists: true, role: 'MANAGER', status: 'INVITED', hasPassword: false, targetStatus: 'DISABLED' }), 'invalid_transition');
  expectLifecycleError(() => assertManagerLifecycleTransition({ exists: true, role: 'MANAGER', status: 'ACTIVE', hasPassword: true, targetStatus: 'ACTIVE' }), 'invalid_transition');
  expectLifecycleError(() => assertManagerLifecycleTransition({ exists: true, role: 'MANAGER', status: 'DISABLED', hasPassword: false, targetStatus: 'ACTIVE' }), 'password_missing');

  assert.doesNotThrow(() => assertUserStatusTransition('ACTIVE', 'DISABLED'));
  assert.doesNotThrow(() => assertUserStatusTransition('DISABLED', 'ACTIVE'));
  assert.throws(
    () => assertActiveAdminWillRemain({ targetRole: 'ADMIN', targetStatus: 'ACTIVE', activeAdminCount: 1 }),
    LastActiveAdminError
  );

  const [layout, page, actions, lifecycle, query, ui, schema, invitations] = await Promise.all([
    readFile('app/admin/layout.tsx', 'utf8'),
    readFile('app/admin/team/page.tsx', 'utf8'),
    readFile('app/admin/team/actions.ts', 'utf8'),
    readFile('lib/users/admin-team-lifecycle.ts', 'utf8'),
    readFile('lib/users/admin-team-queries.ts', 'utf8'),
    readFile('app/admin/team/team-management.tsx', 'utf8'),
    readFile('prisma/schema.prisma', 'utf8'),
    readFile('lib/users/manager-invitations.ts', 'utf8')
  ]);

  assert.match(layout, /href: '\/admin\/team'/);
  assert.match(layout, /ADMIN_ONLY_ROUTES[^\n]*\/admin\/team/);
  assert.match(page, /await requireAdminSession\(\)/);
  assert.match(actions, /createInvitedManager/);
  assert.match(actions, /regenerateManagerInvitation/);
  assert.match(actions, /await requireAdminSession\(\)/g);
  assert.match(actions, /revalidatePath\('\/admin\/team'\)/);

  assert.match(lifecycle, /role: 'MANAGER'/);
  assert.match(lifecycle, /authVersion: \{ increment: 1 \}/);
  assert.match(lifecycle, /TransactionIsolationLevel\.Serializable/);
  assert.match(lifecycle, /await createAuditLog\(tx/);
  assert.match(lifecycle, /MANAGER_DISABLED/);
  assert.match(lifecycle, /MANAGER_ENABLED/);
  assert.doesNotMatch(lifecycle, /tokenHash|invitationUrl/);

  assert.match(query, /managerInvitations:\s*\{/);
  assert.match(query, /take: 1/);
  assert.match(query, /hasPassword: Boolean\(user\.passwordHash\)/);
  assert.doesNotMatch(query, /authVersion/);
  assert.match(ui, /xl:block/);
  assert.match(ui, /xl:hidden/);
  assert.match(ui, /Скопіювати посилання/);
  assert.match(ui, /role="alertdialog"/);
  assert.match(ui, /aria-modal="true"/);

  assert.match(invitations, /tokenHash/);
  assert.doesNotMatch(actions, /tokenHash|passwordHash|authVersion/);
  assert.doesNotMatch(ui, /tokenHash|passwordHash|authVersion/);
  assert.doesNotMatch(schema, /MANAGER_DISABLED\s*\n|MANAGER_ENABLED\s*\n/);

  console.log('Stage Admin Users 2C targeted rules/security checks: PASS');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage 2C check failed.');
  process.exitCode = 1;
});
