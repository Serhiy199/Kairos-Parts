/**
 * READ-ONLY Neon data gate for the normalized CLIENT phone migration.
 * Only aggregate counts and booleans are selected and printed.
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
      WITH client_phones AS (
        SELECT
          "id",
          "phone",
          regexp_replace(btrim(COALESCE("phone", '')), '[ ()-]', '', 'g') AS compact
        FROM "User"
        WHERE "role" = 'CLIENT'
      ), normalized AS (
        SELECT
          "id",
          "phone",
          CASE
            WHEN compact ~ '^0[0-9]{9}$' THEN '+38' || compact
            WHEN compact ~ '^380[0-9]{9}$' THEN '+' || compact
            WHEN compact ~ '^[+]380[0-9]{9}$' THEN compact
            ELSE NULL
          END AS canonical
        FROM client_phones
      ), duplicate_groups AS (
        SELECT canonical, COUNT(*) AS row_count
        FROM normalized
        WHERE canonical IS NOT NULL
        GROUP BY canonical
        HAVING COUNT(*) > 1
      )
      SELECT
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CLIENT')::text AS total_clients,
        (SELECT COUNT(*) FROM client_phones WHERE NULLIF(btrim("phone"), '') IS NOT NULL)::text AS clients_with_phone,
        (SELECT COUNT(*) FROM client_phones WHERE NULLIF(btrim("phone"), '') IS NULL)::text AS clients_without_phone,
        (SELECT COUNT(*) FROM normalized WHERE canonical IS NOT NULL)::text AS valid_normalizable_phones,
        (SELECT COUNT(*) FROM normalized WHERE canonical IS NULL)::text AS invalid_client_phones,
        (SELECT COUNT(*) FROM duplicate_groups)::text AS duplicate_normalized_groups,
        (SELECT COALESCE(SUM(row_count), 0) FROM duplicate_groups)::text AS duplicate_normalized_rows,
        (SELECT COUNT(*) FROM "User" WHERE "role" IN ('ADMIN', 'MANAGER') AND NULLIF(btrim("phone"), '') IS NOT NULL)::text AS staff_with_phone,
        (SELECT COUNT(*) FROM normalized WHERE canonical IS NOT NULL)::text AS expected_backfill_count
    `);

    const row = result.rows[0] ?? {};
    const totalClients = count(row, 'total_clients');
    const clientsWithoutPhone = count(row, 'clients_without_phone');
    const invalidClientPhones = count(row, 'invalid_client_phones');
    const duplicateGroups = count(row, 'duplicate_normalized_groups');
    const expectedBackfillCount = count(row, 'expected_backfill_count');
    const hasBlocker = clientsWithoutPhone > 0
      || invalidClientPhones > 0
      || duplicateGroups > 0
      || expectedBackfillCount !== totalClients;

    for (const key of [
      'total_clients',
      'clients_with_phone',
      'clients_without_phone',
      'valid_normalizable_phones',
      'invalid_client_phones',
      'duplicate_normalized_groups',
      'duplicate_normalized_rows',
      'staff_with_phone',
      'expected_backfill_count'
    ]) {
      console.log(`${key}=${count(row, key)}`);
    }
    console.log(`hasBlocker=${hasBlocker}`);

    if (hasBlocker) {
      throw new Error('Stage Client Auth 2B data gate failed.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage Client Auth 2B preflight failed.');
  process.exitCode = 1;
});
