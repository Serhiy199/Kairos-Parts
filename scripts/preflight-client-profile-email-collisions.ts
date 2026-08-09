/**
 * READ-ONLY, fail-closed preflight for the case-insensitive User email index.
 * It never loads the repository DATABASE_URL implicitly and prints no email values.
 */
import { createRequire } from 'node:module';

type Row = Record<string, unknown>;
type PgClient = {
  connect(): Promise<void>;
  query(sql: string): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (options: { connectionString: string; enableChannelBinding: boolean }) => PgClient;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  if (process.env.CLIENT_PROFILE_EMAIL_AUDIT_CONFIRM_NON_PRODUCTION !== 'YES') {
    throw new Error('Explicit non-production confirmation is required.');
  }

  const connectionString = required('CLIENT_PROFILE_EMAIL_AUDIT_DATABASE_URL');
  const expectedHost = required('CLIENT_PROFILE_EMAIL_AUDIT_EXPECTED_HOST').toLowerCase();
  const expectedDatabase = required('CLIENT_PROFILE_EMAIL_AUDIT_EXPECTED_DATABASE');
  const parsed = new URL(connectionString);

  if (parsed.hostname.toLowerCase() !== expectedHost || parsed.pathname.slice(1) !== expectedDatabase) {
    throw new Error('Database identity does not match the explicit non-production expectation.');
  }

  const client = new Client({ connectionString, enableChannelBinding: true });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const identity = await client.query(`
      SELECT current_database() AS database_name,
             current_setting('transaction_read_only') AS read_only
    `);
    const actualDatabase = String(identity.rows[0]?.database_name ?? '');
    const readOnly = String(identity.rows[0]?.read_only ?? '');
    if (actualDatabase !== expectedDatabase || readOnly !== 'on') {
      throw new Error('Read-only database identity precondition failed.');
    }

    const result = await client.query(`
      SELECT COUNT(*)::text AS collision_groups,
             COALESCE(SUM(row_count), 0)::text AS collision_rows
      FROM (
        SELECT lower("email"), COUNT(*) AS row_count
        FROM "User"
        WHERE "email" IS NOT NULL
        GROUP BY lower("email")
        HAVING COUNT(*) > 1
      ) collisions
    `);
    await client.query('ROLLBACK');

    const collisionGroups = Number(result.rows[0]?.collision_groups ?? 0);
    const collisionRows = Number(result.rows[0]?.collision_rows ?? 0);
    console.log(`database=${actualDatabase}`);
    console.log(`host=${expectedHost}`);
    console.log('transaction_read_only=on');
    console.log(`collision_groups=${collisionGroups}`);
    console.log(`collision_rows=${collisionRows}`);
    if (collisionGroups > 0) {
      throw new Error('Case-insensitive User email collisions block the migration.');
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Client profile email collision preflight failed.');
  process.exitCode = 1;
});
