/** READ-ONLY aggregate audit for persistent credentials rate-limit buckets. */
import { createRequire } from 'node:module';
import { config } from 'dotenv';

import { allRateLimitTestHashes } from './auth-rate-limit-test-fixtures';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

type Row = Record<string, unknown>;
type PgClient = {
  connect(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (options: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();

  try {
    const result = await client.query(`
      WITH duplicate_groups AS (
        SELECT "scope", "keyHash"
        FROM "AuthRateLimitBucket"
        GROUP BY "scope", "keyHash"
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*)::text AS total_buckets,
        COUNT(*) FILTER (WHERE "scope" = 'IDENTIFIER')::text AS identifier_buckets,
        COUNT(*) FILTER (WHERE "scope" = 'IP')::text AS ip_buckets,
        COUNT(*) FILTER (WHERE "scope" = 'IDENTIFIER' AND "blockedUntil" > CURRENT_TIMESTAMP)::text AS active_blocked_identifier,
        COUNT(*) FILTER (WHERE "scope" = 'IP' AND "blockedUntil" > CURRENT_TIMESTAMP)::text AS active_blocked_ip,
        COUNT(*) FILTER (WHERE "blockedUntil" IS NOT NULL AND "blockedUntil" <= CURRENT_TIMESTAMP)::text AS expired_buckets,
        COUNT(*) FILTER (WHERE "scope"::text NOT IN ('IDENTIFIER', 'IP'))::text AS invalid_scope,
        COUNT(*) FILTER (WHERE "keyHash" !~ '^[0-9a-f]{64}$')::text AS invalid_key_hash,
        COUNT(*) FILTER (WHERE "attemptCount" < 0)::text AS negative_attempt_count,
        COUNT(*) FILTER (WHERE "attemptCount" = 0)::text AS zero_attempt_count,
        COUNT(*) FILTER (WHERE "blockedUntil" < "windowStart")::text AS invalid_block_window,
        COUNT(*) FILTER (WHERE "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '48 hours')::text AS stale_rows,
        (SELECT COUNT(*) FROM duplicate_groups)::text AS duplicate_groups
      FROM "AuthRateLimitBucket"
    `);
    const testResult = await client.query(
      `SELECT COUNT(*)::text AS test_rows_left
       FROM "AuthRateLimitBucket"
       WHERE "keyHash" = ANY($1::bpchar[])`,
      [allRateLimitTestHashes()]
    );
    const row = { ...(result.rows[0] ?? {}), ...(testResult.rows[0] ?? {}) };
    const keys = [
      'total_buckets',
      'identifier_buckets',
      'ip_buckets',
      'active_blocked_identifier',
      'active_blocked_ip',
      'expired_buckets',
      'invalid_scope',
      'invalid_key_hash',
      'negative_attempt_count',
      'zero_attempt_count',
      'invalid_block_window',
      'stale_rows',
      'duplicate_groups',
      'test_rows_left'
    ];

    for (const key of keys) console.log(`${key}=${Number(row[key] ?? 0)}`);

    const blockerKeys = [
      'invalid_scope',
      'invalid_key_hash',
      'negative_attempt_count',
      'zero_attempt_count',
      'invalid_block_window',
      'duplicate_groups',
      'test_rows_left'
    ];
    const hasBlocker = blockerKeys.some((key) => Number(row[key] ?? 0) > 0);
    console.log(`hasBlocker=${hasBlocker}`);
    if (hasBlocker) throw new Error('Stage Client Auth 2C aggregate audit failed.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage Client Auth 2C audit failed.');
  process.exitCode = 1;
});
