/**
 * READ-ONLY post-migration audit for CLIENT normalized phone identity.
 * The query returns aggregate counts only and never selects PII or credentials.
 */
import { createRequire } from 'node:module';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

type Row = Record<string, unknown>;
type PgClient = {
  connect(): Promise<void>;
  query(sql: string): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (options: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

function count(row: Row, key: string) {
  return Number(row[key] ?? 0);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();

  try {
    const result = await client.query(`
      WITH normalized_raw AS (
        SELECT
          "id",
          CASE
            WHEN compact ~ '^0[0-9]{9}$' THEN '+38' || compact
            WHEN compact ~ '^380[0-9]{9}$' THEN '+' || compact
            WHEN compact ~ '^[+]380[0-9]{9}$' THEN compact
            ELSE NULL
          END AS canonical
        FROM (
          SELECT "id", regexp_replace(btrim(COALESCE("phone", '')), '[ ()-]', '', 'g') AS compact
          FROM "User"
          WHERE "role" = 'CLIENT'
        ) raw
      ), duplicate_groups AS (
        SELECT "normalizedPhone", COUNT(*) AS row_count
        FROM "User"
        WHERE "normalizedPhone" IS NOT NULL
        GROUP BY "normalizedPhone"
        HAVING COUNT(*) > 1
      )
      SELECT
        (SELECT COUNT(*) FROM "User")::text AS total_users,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT')::text AS client_total,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'ADMIN')::text AS admin_total,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'MANAGER')::text AS manager_total,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT' AND "normalizedPhone" IS NOT NULL)::text AS client_with_normalized_phone,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT' AND "normalizedPhone" IS NULL)::text AS client_without_normalized_phone,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'ADMIN' AND "normalizedPhone" IS NOT NULL)::text AS admin_with_normalized_phone,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'MANAGER' AND "normalizedPhone" IS NOT NULL)::text AS manager_with_normalized_phone,
        (SELECT COUNT(*) FROM duplicate_groups)::text AS duplicate_normalized_groups,
        (SELECT COALESCE(SUM(row_count), 0) FROM duplicate_groups)::text AS duplicate_normalized_rows,
        (SELECT COUNT(*) FROM "User" WHERE "normalizedPhone" IS NOT NULL AND "normalizedPhone" !~ '^[+]380[0-9]{9}$')::text AS invalid_normalized_format,
        (SELECT COUNT(*) FROM "User" u JOIN normalized_raw n ON n."id" = u."id" WHERE n.canonical IS DISTINCT FROM u."normalizedPhone")::text AS raw_normalized_mismatch,
        (SELECT COUNT(*) FROM "User" WHERE "role" <> 'CLIENT' AND "normalizedPhone" IS NOT NULL)::text AS normalized_phone_on_non_client,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT' AND "status" = 'ACTIVE' AND "passwordHash" IS NULL)::text AS active_client_without_password,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT' AND "authVersion" IS NULL)::text AS client_auth_version_null,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT' AND "authVersion" < 1)::text AS client_auth_version_less_than_one
    `);

    const row = result.rows[0] ?? {};
    const keys = [
      'total_users',
      'client_total',
      'admin_total',
      'manager_total',
      'client_with_normalized_phone',
      'client_without_normalized_phone',
      'admin_with_normalized_phone',
      'manager_with_normalized_phone',
      'duplicate_normalized_groups',
      'duplicate_normalized_rows',
      'invalid_normalized_format',
      'raw_normalized_mismatch',
      'normalized_phone_on_non_client',
      'active_client_without_password',
      'client_auth_version_null',
      'client_auth_version_less_than_one'
    ] as const;

    for (const key of keys) console.log(`${key}=${count(row, key)}`);

    const clientTotal = count(row, 'client_total');
    const blockers = [
      count(row, 'client_with_normalized_phone') !== clientTotal,
      count(row, 'client_without_normalized_phone') > 0,
      count(row, 'admin_with_normalized_phone') > 0,
      count(row, 'manager_with_normalized_phone') > 0,
      count(row, 'duplicate_normalized_groups') > 0,
      count(row, 'invalid_normalized_format') > 0,
      count(row, 'raw_normalized_mismatch') > 0,
      count(row, 'normalized_phone_on_non_client') > 0,
      count(row, 'active_client_without_password') > 0,
      count(row, 'client_auth_version_null') > 0,
      count(row, 'client_auth_version_less_than_one') > 0
    ];
    const hasBlocker = blockers.some(Boolean);
    console.log(`hasBlocker=${hasBlocker}`);

    if (hasBlocker) throw new Error('Stage Client Auth 2B post-migration audit failed.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage Client Auth 2B audit failed.');
  process.exitCode = 1;
});
