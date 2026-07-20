import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

import {
  classifyManagerInvitation,
  getManagerInvitationExpiry,
  isValidManagerEmail,
  isValidManagerName,
  isValidManagerPassword,
  MANAGER_INVITATION_TOKEN_BYTES,
  MANAGER_INVITATION_TTL_HOURS,
  normalizeManagerEmail,
  normalizeManagerName
} from '../lib/users/manager-invitation-rules';

type QueryResult = { rows: Array<Record<string, string>> };
type PgClient = {
  connect(): Promise<void>;
  query(sql: string): Promise<QueryResult>;
  end(): Promise<void>;
};

const loadModule = createRequire(import.meta.url);
const { Client } = loadModule('pg') as {
  Client: new (config: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

const mode = process.argv[2];

async function runRulesChecks() {
  const now = new Date('2026-07-20T12:00:00.000Z');
  const expiresAt = getManagerInvitationExpiry(now);

  assert.equal(MANAGER_INVITATION_TOKEN_BYTES, 32);
  assert.equal(MANAGER_INVITATION_TTL_HOURS, 48);
  assert.equal(expiresAt.getTime() - now.getTime(), 48 * 60 * 60 * 1000);
  assert.equal(normalizeManagerEmail('  Manager@Example.COM '), 'manager@example.com');
  assert.equal(normalizeManagerName('  Тестовий   Менеджер '), 'Тестовий Менеджер');
  assert.equal(isValidManagerEmail('manager@example.com'), true);
  assert.equal(isValidManagerEmail('manager.example.com'), false);
  assert.equal(isValidManagerName('М'), false);
  assert.equal(isValidManagerName('Тестовий Менеджер'), true);
  assert.equal(isValidManagerPassword('1234567'), false);
  assert.equal(isValidManagerPassword('Test1234!'), true);

  const baseState = {
    usedAt: null,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 1_000),
    userRole: 'MANAGER' as const,
    userStatus: 'INVITED' as const,
    now
  };

  assert.equal(classifyManagerInvitation(baseState), 'active');
  assert.equal(classifyManagerInvitation({ ...baseState, usedAt: now }), 'used');
  assert.equal(classifyManagerInvitation({ ...baseState, revokedAt: now }), 'revoked');
  assert.equal(classifyManagerInvitation({ ...baseState, expiresAt: now }), 'expired');
  assert.equal(classifyManagerInvitation({ ...baseState, userRole: 'CLIENT' }), 'invalid');
  assert.equal(classifyManagerInvitation({ ...baseState, userStatus: 'ACTIVE' }), 'account_active');
  assert.equal(classifyManagerInvitation({ ...baseState, userStatus: 'DISABLED' }), 'account_disabled');

  const serviceSource = await readFile('lib/users/manager-invitations.ts', 'utf8');
  const schemaSource = await readFile('prisma/schema.prisma', 'utf8');
  assert.match(serviceSource, /randomBytes\(MANAGER_INVITATION_TOKEN_BYTES\)/);
  assert.match(serviceSource, /createHash\('sha256'\)/);
  assert.match(schemaSource, /tokenHash\s+String\s+@unique/);
  assert.doesNotMatch(serviceSource, /metadata:\s*\{[^}]*\b(?:token|tokenHash|password|passwordHash|invitationUrl)\b/i);
  assert.match(serviceSource, /authVersion:\s*\{ increment: 1 \}/);
  assert.match(serviceSource, /usedAt:\s*now/);
  assert.match(serviceSource, /revokedAt:\s*now/);
  assert.match(serviceSource, /TransactionIsolationLevel\.Serializable/);

  console.log('Stage Admin Users 2B targeted rules/security checks: PASS');
}

async function runCounts(includeInvitations: boolean) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();

  try {
    const aggregate = await client.query(`
      SELECT
        COUNT(*)::text AS users,
        COUNT(*) FILTER (WHERE "role" IN ('ADMIN', 'MANAGER'))::text AS staff,
        COUNT(*) FILTER (WHERE "status" = 'INVITED')::text AS invited,
        COUNT(*) FILTER (WHERE "passwordHash" IS NULL)::text AS passwordless
      FROM "User"
    `);
    const authVersions = await client.query(`
      SELECT "authVersion"::text AS value, COUNT(*)::text AS count
      FROM "User"
      GROUP BY "authVersion"
      ORDER BY "authVersion" ASC
    `);
    const row = aggregate.rows[0];
    const result: Record<string, unknown> = {
      users: Number(row.users),
      staff: Number(row.staff),
      invited: Number(row.invited),
      passwordless: Number(row.passwordless),
      authVersions: authVersions.rows.map((item) => ({
        value: Number(item.value),
        count: Number(item.count)
      }))
    };

    if (includeInvitations) {
      const invitationCount = await client.query(
        'SELECT COUNT(*)::text AS count FROM "ManagerInvitation"'
      );
      result.managerInvitations = Number(invitationCount.rows[0].count);
    }

    console.log(JSON.stringify(result));
  } finally {
    await client.end();
  }
}

async function main() {
  if (mode === '--counts-before') {
    await runCounts(false);
    return;
  }

  if (mode === '--counts-after') {
    await runCounts(true);
    return;
  }

  await runRulesChecks();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Stage 2B check failed.');
    process.exitCode = 1;
  });
