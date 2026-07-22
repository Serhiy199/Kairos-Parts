import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  auditAnonymousActor,
  auditSystemActor,
  auditUserActor,
  canReadFullAuditLog
} from '../lib/audit-log/contracts';
import {
  AUDIT_PAYLOAD_LIMITS,
  buildAuditDiff,
  sanitizeAuditPayload
} from '../lib/audit-log/payload';
import { getAuditExpiry } from '../lib/audit-log/retention';
import {
  resolveAuditActor,
  writeAuditLog
} from '../lib/audit-log/service';

function expectIso(category: Parameters<typeof getAuditExpiry>[0], source: string, expected: string) {
  assert.equal(getAuditExpiry(category, new Date(source)).toISOString(), expected);
}

async function main() {
expectIso('TECHNICAL', '2026-01-01T10:20:30.000Z', '2026-01-31T10:20:30.000Z');
expectIso('LOGIN', '2026-01-01T10:20:30.000Z', '2026-01-31T10:20:30.000Z');
expectIso('CRITICAL_READ', '2026-01-01T10:20:30.000Z', '2026-01-31T10:20:30.000Z');
expectIso('STANDARD', '2026-01-01T10:20:30.000Z', '2026-02-15T10:20:30.000Z');
expectIso('FINANCIAL_CRITICAL', '2026-01-31T10:20:30.000Z', '2026-05-31T10:20:30.000Z');
expectIso('FINANCIAL_CRITICAL', '2023-10-31T23:30:00.000Z', '2024-02-29T23:30:00.000Z');
assert.throws(() => getAuditExpiry('UNKNOWN' as Parameters<typeof getAuditExpiry>[0], new Date()), /Unsupported/);

class Decimal {
  constructor(private readonly value: string) {}
  toString() { return this.value; }
}

const cyclic: Record<string, unknown> = { safe: 'kept' };
cyclic.self = cyclic;
const sanitized = sanitizeAuditPayload({
  status: 'ACTIVE',
  ignored: 'remove-me',
  password: 'top-secret',
  token: 'top-token',
  nested: { safe: true, resetToken: 'nested-secret' },
  long: 'x'.repeat(1500),
  values: Array.from({ length: 75 }, (_, index) => index),
  date: new Date('2024-02-29T12:00:00.000Z'),
  amount: new Decimal('123.45'),
  count: BigInt(42),
  optional: undefined,
  cyclic
}, [
  'status', 'ignored-allowlist-proof', 'password', 'token', 'nested', 'long',
  'values', 'date', 'amount', 'count', 'optional', 'cyclic'
]);

assert.equal(sanitized?.status, 'ACTIVE');
assert.equal('ignored' in (sanitized ?? {}), false);
assert.equal('password' in (sanitized ?? {}), false);
assert.equal('token' in (sanitized ?? {}), false);
assert.deepEqual(sanitized?.nested, { safe: true });
assert.equal(typeof sanitized?.long, 'string');
assert.ok((sanitized?.long as string).length <= AUDIT_PAYLOAD_LIMITS.maxStringLength);
assert.equal((sanitized?.values as unknown[]).length, AUDIT_PAYLOAD_LIMITS.maxArrayLength);
assert.equal(sanitized?.date, '2024-02-29T12:00:00.000Z');
assert.equal(sanitized?.amount, '123.45');
assert.equal(sanitized?.count, '42');
assert.equal('optional' in (sanitized ?? {}), false);
assert.deepEqual(sanitized?.cyclic, { safe: 'kept' });
const boundedPayload = sanitizeAuditPayload({
  matrix: Array.from({ length: 50 }, () => Array.from({ length: 50 }, () => 'x'.repeat(1000)))
}, ['matrix']);
assert.ok(JSON.stringify(boundedPayload).length <= AUDIT_PAYLOAD_LIMITS.maxTotalCharacters);

const noChange = buildAuditDiff(
  { status: 'ACTIVE', at: new Date('2026-01-01T00:00:00.000Z') },
  { status: 'ACTIVE', at: new Date('2026-01-01T00:00:00.000Z') },
  ['status', 'at']
);
assert.equal(noChange.before, undefined);
assert.equal(noChange.after, undefined);

const diff = buildAuditDiff(
  { status: null, ignored: 'before' },
  { status: 'ACTIVE', ignored: 'after' },
  ['status']
);
assert.deepEqual(diff.before, { status: null });
assert.deepEqual(diff.after, { status: 'ACTIVE' });

const createdRecords: Array<Record<string, unknown>> = [];
const mockWriter = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === 'user-1'
      ? { id: 'user-1', name: 'Audit Admin', email: 'ADMIN@EXAMPLE.COM', role: 'ADMIN' as const }
      : null
  },
  auditLog: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createdRecords.push(data);
      return data;
    }
  }
} as unknown as Parameters<typeof writeAuditLog>[0];

assert.deepEqual(await resolveAuditActor(mockWriter, auditUserActor('user-1')), {
  actorId: 'user-1',
  actorName: 'Audit Admin',
  actorEmail: 'admin@example.com',
  actorRole: 'ADMIN'
});
assert.deepEqual(await resolveAuditActor(mockWriter, auditSystemActor('Retention worker')), {
  actorId: null,
  actorName: 'Retention worker',
  actorEmail: null,
  actorRole: null
});
assert.deepEqual(await resolveAuditActor(mockWriter, auditAnonymousActor()), {
  actorId: null,
  actorName: null,
  actorEmail: null,
  actorRole: null
});

await writeAuditLog(mockWriter, {
  actor: auditUserActor('user-1'),
  entityType: 'USER',
  entityId: 'target-1',
  entityLabel: 'Test manager',
  action: 'ENTITY_UPDATED',
  category: 'STANDARD',
  oldValue: { status: 'INVITED', passwordHash: 'never-store' },
  newValue: { status: 'ACTIVE', passwordHash: 'never-store' },
  metadata: { event: 'TEST', nested: { secret: 'never-store', safe: 'kept' } },
  allowedFields: {
    oldValue: ['status', 'passwordHash'],
    newValue: ['status', 'passwordHash'],
    metadata: ['event', 'nested']
  },
  requestContext: {
    ipAddress: '203.0.113.4, 10.0.0.1',
    userAgent: `Test\u0000Agent ${'x'.repeat(600)}`
  },
  createdAt: new Date('2026-01-01T00:00:00.000Z')
});

assert.equal(createdRecords.length, 1);
assert.equal(createdRecords[0]?.category, 'STANDARD');
assert.equal((createdRecords[0]?.expiresAt as Date).toISOString(), '2026-02-15T00:00:00.000Z');
assert.equal(createdRecords[0]?.actorName, 'Audit Admin');
assert.equal(createdRecords[0]?.ipAddress, '203.0.113.4');
assert.equal((createdRecords[0]?.userAgent as string).length, 512);
assert.deepEqual(createdRecords[0]?.oldValue, { status: 'INVITED' });
assert.deepEqual(createdRecords[0]?.newValue, { status: 'ACTIVE' });
assert.deepEqual(createdRecords[0]?.metadata, { event: 'TEST', nested: { safe: 'kept' } });

assert.equal(canReadFullAuditLog('ADMIN'), true);
assert.equal(canReadFullAuditLog('MANAGER'), false);
assert.equal(canReadFullAuditLog(null), false);

const root = process.cwd();
const pageSource = readFileSync(path.join(root, 'app/admin/audit-log/page.tsx'), 'utf8');
const layoutSource = readFileSync(path.join(root, 'app/admin/layout.tsx'), 'utf8');
assert.match(pageSource, /requireAdminSession\(\)/);
assert.doesNotMatch(pageSource, /requireCrmSession\(\)/);
assert.match(layoutSource, /ADMIN_ONLY_ROUTES[\s\S]+?\/admin\/audit-log/);
assert.equal(existsSync(path.join(root, 'app/api/admin/audit-log/route.ts')), false);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (['.git', '.next', 'node_modules'].includes(entry)) return [];
    const target = path.join(directory, entry);
    if (statSync(target).isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx)$/.test(entry) ? [target] : [];
  });
}

for (const file of sourceFiles(root)) {
  if (file.endsWith('check-admin-audit-log-2.ts')) continue;
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /auditLog\.(?:update|updateMany|delete|deleteMany|upsert)\s*\(/, file);
  if (!file.endsWith(path.join('lib', 'audit-log', 'service.ts'))) {
    assert.doesNotMatch(source, /auditLog\.create\s*\(/, file);
  }
}

  console.log('Admin Audit Log 2 verification passed.');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Audit verification failed.');
  process.exitCode = 1;
});
