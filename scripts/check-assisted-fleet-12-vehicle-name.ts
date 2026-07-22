import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import { config } from 'dotenv';

import { getVehicleDisplay, validateVehicleName } from '../lib/vehicles/name';
import { isEditableVehicleField, normalizeEditableVehicleValue } from '../lib/vehicles/change-snapshot';

config({ path: '.env.local', quiet: true });

if (process.env.DATABASE_URL_UNPOOLED) {
  const databaseUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
  databaseUrl.searchParams.delete('channel_binding');
  databaseUrl.searchParams.set('sslmode', 'verify-full');
  process.env.DATABASE_URL = databaseUrl.toString();
}

const requireForAudit = createRequire(import.meta.url);
type PgResult<Row> = { rows: Row[] };
type PgClientInstance = { connect(): Promise<void>; end(): Promise<void>; query<Row>(sql: string): Promise<PgResult<Row>> };
type PgClientConstructor = new (config: { connectionString: string }) => PgClientInstance;
const { Client: PgClient } = requireForAudit('pg') as { Client: PgClientConstructor };

async function main() {
  assert.deepEqual(validateVehicleName('  Основний   трактор  '), { ok: true, name: 'Основний трактор' });
  assert.equal(validateVehicleName('').ok, false);
  assert.equal(validateVehicleName('   ').ok, false);
  assert.equal(validateVehicleName('x'.repeat(121)).ok, false);
  assert.equal(isEditableVehicleField('name'), true);
  assert.equal(normalizeEditableVehicleValue('name', '  Навантажувач №2  '), 'Навантажувач №2');
  assert.deepEqual(getVehicleDisplay({ name: 'YTO NLX 1054', manufacturer: 'YTO', model: 'NLX 1054' }), {
    title: 'YTO NLX 1054', secondary: null
  });
  assert.deepEqual(getVehicleDisplay({ name: 'Основний трактор', manufacturer: 'YTO', model: 'NLX 1054' }), {
    title: 'Основний трактор', secondary: 'YTO · NLX 1054'
  });

  const migration = await readFile('prisma/migrations/20260722141000_add_vehicle_name/migration.sql', 'utf8');
  assert.match(migration, /ADD COLUMN "name" TEXT/);
  assert.match(migration, /CONCAT_WS/);
  assert.match(migration, /'Техніка'/);
  assert.match(migration, /ALTER COLUMN "name" SET NOT NULL/);
  assert.doesNotMatch(migration, /vinOrSerial|clientId|companyId/);

  const requiredSources = [
    ['client form', 'app/client/vehicles/vehicle-form.tsx', /name="name"/],
    ['admin form', 'components/vehicles/admin-vehicle-form.tsx', /name="name"/],
    ['client create', 'app/client/vehicles/actions.ts', /name: nameResult/],
    ['admin create', 'app/admin/vehicles/actions.ts', /name: validation\.data\.name/],
    ['change request', 'lib/change-requests/apply.ts', /name: 'name'/],
    ['change request apply', 'lib/change-requests/apply.ts', /tx\.vehicle\.update/],
    ['change request audit', 'lib/change-requests/service.ts', /createAuditLog/],
    ['audit label', 'lib/audit-log/presentation.ts', /name: 'Назва техніки'/],
    ['telegram select', 'lib/telegram/session.ts', /name: true/],
    ['telegram label', 'lib/telegram/messages.ts', /vehicle\.name/],
    ['client card', 'app/client/vehicles/page.tsx', /display\.title/]
  ] as const;
  for (const [label, file, pattern] of requiredSources) {
    assert.match(await readFile(file, 'utf8'), pattern, label);
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const preflight = await client.query<{
      total: string; empty_manufacturer: string; empty_model: string; empty_type: string; fallback_unavailable: string;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM("manufacturer"), '') IS NULL)::text AS empty_manufacturer,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM("model"), '') IS NULL)::text AS empty_model,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM("type"), '') IS NULL)::text AS empty_type,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM("manufacturer"), '') IS NULL AND NULLIF(BTRIM("model"), '') IS NULL AND NULLIF(BTRIM("type"), '') IS NULL)::text AS fallback_unavailable
      FROM "Vehicle"
    `);
    const column = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Vehicle' AND column_name = 'name'
      ) AS exists
    `);
    let postMigration: null | Record<string, number | boolean> = null;
    if (column.rows[0]?.exists) {
      const result = await client.query<{ invalid_names: string; ownership_violations: string; constraint_exists: boolean }>(`
        SELECT
          (SELECT COUNT(*) FROM "Vehicle" WHERE "name" IS NULL OR CHAR_LENGTH(BTRIM("name")) < 2 OR CHAR_LENGTH("name") > 120)::text AS invalid_names,
          (SELECT COUNT(*) FROM "Vehicle" WHERE (("clientId" IS NOT NULL)::int + ("companyId" IS NOT NULL)::int) <> 1)::text AS ownership_violations,
          EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_name_length_check') AS constraint_exists
      `);
      postMigration = {
        invalidNames: Number(result.rows[0]?.invalid_names ?? -1),
        ownershipViolations: Number(result.rows[0]?.ownership_violations ?? -1),
        constraintExists: Boolean(result.rows[0]?.constraint_exists)
      };
      assert.deepEqual(postMigration, { invalidNames: 0, ownershipViolations: 0, constraintExists: true });
    }
    console.log(JSON.stringify({ helperChecks: 'passed', staticContracts: 'passed', preflight: preflight.rows[0], nameColumnExists: Boolean(column.rows[0]?.exists), postMigration }, null, 2));
  } finally {
    await client.end();
  }

  console.log(JSON.stringify({ changeRequestContracts: 'passed', persistentTestRecords: 0 }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
