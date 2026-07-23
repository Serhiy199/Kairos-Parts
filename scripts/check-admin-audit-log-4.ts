import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { canReadFullAuditLog } from '../lib/audit-log/contracts';
import {
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_SEARCH_MAX_LENGTH,
  auditLogQuery,
  buildAuditLogWhere,
  parseAuditLogFilters
} from '../lib/audit-log/filters';
import {
  auditActionLabel,
  auditActorLabel,
  auditCategoryLabel,
  auditDiffRows,
  auditEntityLabel,
  auditFieldLabel,
  formatAuditMetadata,
  formatAuditValue
} from '../lib/audit-log/presentation';
import { canAccessPath } from '../lib/auth/permissions';

const root = process.cwd();

async function source(file: string) {
  return readFile(path.join(root, file), 'utf8');
}

function assertAccessContracts() {
  assert.equal(canReadFullAuditLog('ADMIN'), true);
  assert.equal(canReadFullAuditLog('MANAGER'), false);
  assert.equal(canAccessPath('/admin/audit-log', 'ADMIN'), true);
  assert.equal(canAccessPath('/admin/audit-log', 'MANAGER'), false);
  assert.equal(canAccessPath('/admin/audit-log/event-1', 'MANAGER'), false);
  assert.equal(canAccessPath('/admin/team/user-1/activity', 'MANAGER'), false);
}

function assertFilterParsing() {
  const valid = parseAuditLogFilters({
    search: '  manager@example.com  ',
    actor: 'actor-1',
    category: 'STANDARD',
    entity: 'REQUEST',
    action: 'REQUEST_STATUS_CHANGED',
    from: '2026-07-01',
    to: '2026-07-22',
    critical: '1',
    page: '3'
  });
  assert.equal(valid.search, 'manager@example.com');
  assert.equal(valid.actorId, 'actor-1');
  assert.equal(valid.category, 'STANDARD');
  assert.equal(valid.entityType, 'REQUEST');
  assert.equal(valid.action, 'REQUEST_STATUS_CHANGED');
  assert.equal(valid.dateFrom, '2026-07-01');
  assert.equal(valid.dateTo, '2026-07-22');
  assert.equal(valid.criticalOnly, true);
  assert.equal(valid.page, 3);
  assert.equal(AUDIT_LOG_PAGE_SIZE, 25);

  const invalid = parseAuditLogFilters({
    search: `  ${'x'.repeat(300)}  `,
    category: 'ROOT',
    entity: 'OBSOLETE',
    action: 'DROP_TABLE',
    from: '2026-02-31',
    to: 'not-a-date',
    page: '-10'
  });
  assert.equal(invalid.search.length, AUDIT_SEARCH_MAX_LENGTH);
  assert.equal(invalid.category, null);
  assert.equal(invalid.entityType, null);
  assert.equal(invalid.action, null);
  assert.equal(invalid.dateFrom, '');
  assert.equal(invalid.dateTo, '');
  assert.equal(invalid.page, 1);
}

function assertWhereComposition() {
  const filters = parseAuditLogFilters({
    search: 'KP-42',
    actor: 'other-actor',
    category: 'STANDARD',
    entity: 'REQUEST',
    action: 'REQUEST_STATUS_CHANGED',
    from: '2026-07-01',
    to: '2026-07-22',
    critical: '1',
    page: '2'
  });
  const where = buildAuditLogWhere(filters, 'fixed-actor');
  const serialized = JSON.stringify(where);
  assert.match(serialized, /"AND"/);
  assert.match(serialized, /"actorId":"fixed-actor"/);
  assert.doesNotMatch(serialized, /other-actor/);
  assert.match(serialized, /"OR"/);
  assert.match(serialized, /"category":"STANDARD"/);
  assert.match(serialized, /"entityType":"REQUEST"/);
  assert.match(serialized, /"action":"REQUEST_STATUS_CHANGED"/);
  assert.match(serialized, /FINANCIAL_CRITICAL/);
  assert.match(serialized, /CRITICAL_READ/);
  assert.match(serialized, /"gte"/);
  assert.match(serialized, /"lte"/);

  const query = auditLogQuery(filters, { page: 4 });
  assert.match(query, /search=KP-42/);
  assert.match(query, /critical=1/);
  assert.match(query, /page=4/);
}

function assertPresentation() {
  assert.equal(auditActorLabel({
    actorName: 'Snapshot Name',
    actorEmail: 'snapshot@example.com',
    actorRole: 'MANAGER',
    actor: { name: 'Current Name', email: 'current@example.com', role: 'MANAGER' }
  }), 'Snapshot Name');
  assert.equal(auditActorLabel({
    actorName: null,
    actorEmail: null,
    actorRole: null,
    actor: { name: 'Current Name', email: null, role: 'MANAGER' }
  }), 'Current Name');
  assert.equal(auditActorLabel({
    actorName: null,
    actorEmail: null,
    actorRole: null,
    actor: null
  }), 'Системна дія');

  assert.equal(auditActionLabel('REQUEST_STATUS_CHANGED'), 'Статус заявки змінено');
  assert.equal(auditCategoryLabel('FINANCIAL_CRITICAL'), 'Фінансово-критична');
  assert.equal(auditEntityLabel({ entityType: 'REQUEST', entityId: 'request-1234567890', entityLabel: null }), 'Заявка request-1234…');
  assert.equal(formatAuditValue(true), 'Так');
  assert.equal(formatAuditValue(false), 'Ні');
  assert.equal(formatAuditValue(null), '—');
  assert.match(formatAuditValue('120.00', 'total'), /120,00.*UAH/);
  assert.equal(formatAuditValue('ACTIVE', 'status'), 'Активний');
  assert.equal(auditFieldLabel('unknownField_name'), 'Unknown Field name');
  assert.equal(formatAuditValue('x'.repeat(500)).length, 320);

  const diff = auditDiffRows(
    { status: 'NEW', total: '100.00', unchanged: true },
    { status: 'IN_PROGRESS', total: '120.00', unchanged: true }
  );
  assert.equal(diff.find((row) => row.key === 'status')?.before, 'Нова заявка');
  assert.equal(diff.find((row) => row.key === 'status')?.after, 'Підбір у роботі');
  assert.equal(diff.find((row) => row.key === 'total')?.changed, true);
  assert.equal(diff.find((row) => row.key === 'unchanged')?.changed, false);

  const metadata = formatAuditMetadata({
    source: 'ADMIN_CRM',
    itemCount: 3,
    privateUrl: 'https://private.example',
    token: 'secret'
  });
  assert.deepEqual(metadata.map((item) => item.key), ['source', 'itemCount']);
}

async function assertStaticArchitecture() {
  const [
    page,
    detail,
    activity,
    query,
    filters,
    layout,
    team,
    permissions
  ] = await Promise.all([
    source('app/admin/audit-log/page.tsx'),
    source('app/admin/audit-log/[id]/page.tsx'),
    source('app/admin/team/[userId]/activity/page.tsx'),
    source('lib/audit-log/query.ts'),
    source('lib/audit-log/filters.ts'),
    source('app/admin/layout.tsx'),
    source('app/admin/team/team-management.tsx'),
    source('lib/auth/permissions.ts')
  ]);

  for (const protectedSource of [page, detail, activity]) {
    assert.match(protectedSource, /requireAdminSession\(\)/);
    assert.doesNotMatch(protectedSource, /requireCrmSession\(\)/);
  }
  assert.match(layout, /ADMIN_ONLY_ROUTES[\s\S]+\/admin\/audit-log/);
  assert.match(permissions, /ADMIN_ONLY_ROUTE_PREFIXES[\s\S]+\/admin\/audit-log/);
  assert.match(team, /Переглянути історію/);
  assert.match(team, /\/admin\/team\/\$\{member\.id\}\/activity/);

  assert.match(query, /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/);
  assert.match(query, /skip: \(page - 1\) \* AUDIT_LOG_PAGE_SIZE/);
  assert.match(query, /take: AUDIT_LOG_PAGE_SIZE/);
  assert.match(query, /count\(\{ where \}\)/);
  assert.match(query, /getAuditLogPage\(filters: AuditLogFilters, fixedActorId\?: string\)/);
  assert.match(query, /groupBy\(/);
  assert.match(filters, /category: \{ in: \['FINANCIAL_CRITICAL', 'CRITICAL_READ'\] \}/);
  assert.doesNotMatch(filters, /oldValue|newValue|metadata.*contains/);

  assert.match(page, /AuditLogFiltersForm/);
  assert.match(page, /AuditLogPagination/);
  assert.match(detail, /AuditBeforeAfter/);
  assert.match(activity, /getAuditLogPage\(filters, userId\)/);
  assert.match(activity, /Для цього працівника поки немає записів/);
}

async function main() {
  assertAccessContracts();
  assertFilterParsing();
  assertWhereComposition();
  assertPresentation();
  await assertStaticArchitecture();
  process.stdout.write('Admin Audit Log 4 verification passed.\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
