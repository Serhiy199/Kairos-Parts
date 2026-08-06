import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const clientLayout = read('app/client/layout.tsx');
const adminLayout = read('app/admin/layout.tsx');
const dashboardShell = read('components/layout/dashboard-shell.tsx');
const schema = read('prisma/schema.prisma');

const clientNav = clientLayout.match(/const clientNavItems = \[([\s\S]*?)\n  \];/)?.[1];
const adminNav = adminLayout.match(/const adminNavItems = \[([\s\S]*?)\n\];/)?.[1];

assert.ok(clientNav, 'Client navigation configuration must remain discoverable.');
assert.ok(adminNav, 'Admin navigation configuration must remain discoverable.');

assert.doesNotMatch(clientNav, /\/client\/change-requests|Запити на зміну|icon: 'changes'/);
assert.doesNotMatch(adminNav, /\/admin\/change-requests|Запити змін|icon: 'changes'/);

for (const href of ['/client', '/client/requests', '/client/logistics', '/client/vehicles', '/client/documents', '/client/profile']) {
  assert.match(clientNav, new RegExp(`href: '${href.replaceAll('/', '\\/')}'`));
}

for (const href of ['/admin', '/admin/requests', '/admin/logistics', '/admin/clients', '/admin/companies', '/admin/audit-log', '/admin/team']) {
  assert.match(adminNav, new RegExp(`href: '${href.replaceAll('/', '\\/')}'`));
}

assert.match(adminLayout, /session\.user\.role === 'ADMIN'/);
assert.match(adminLayout, /adminNavItems\.filter\(\(item\) => !ADMIN_ONLY_ROUTES\.includes\(item\.href\)\)/);
assert.equal(dashboardShell.split('<SidebarContent').length - 1, 2);
assert.equal(dashboardShell.split('navItems={navItems}').length - 1, 2);
assert.doesNotMatch(dashboardShell, /TbArrowsExchange|changes: TbArrowsExchange/);

assert.equal(existsSync(resolve(root, 'app/client/change-requests/page.tsx')), true);
assert.equal(existsSync(resolve(root, 'app/admin/change-requests/page.tsx')), true);
assert.equal(existsSync(resolve(root, 'app/api/client/change-requests/route.ts')), true);
assert.equal(existsSync(resolve(root, 'app/api/admin/change-requests/route.ts')), true);
assert.equal(existsSync(resolve(root, 'lib/change-requests/service.ts')), true);
assert.match(schema, /model ChangeRequest\s*\{/);

assert.doesNotMatch(clientLayout, /prisma\.changeRequest|pendingChangeRequestsCount|changeRequestsBadge/);
assert.doesNotMatch(adminLayout, /prisma\.changeRequest|pendingChangeRequestsCount|changeRequestsBadge/);

console.log('Cabinet Change Requests navigation cleanup checks passed.');
