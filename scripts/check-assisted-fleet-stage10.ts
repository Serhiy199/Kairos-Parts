import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  diffVehicleFields,
  isEditableVehicleField,
  normalizeEditableVehicleValue
} from '../lib/vehicles/change-snapshot';

config({ path: '.env.local', quiet: true });

if (process.env.DATABASE_URL_UNPOOLED) {
  const databaseUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
  databaseUrl.searchParams.delete('channel_binding');
  databaseUrl.searchParams.set('sslmode', 'verify-full');
  process.env.DATABASE_URL = databaseUrl.toString();
}

const requireForAudit = createRequire(import.meta.url);
type PgClientInstance = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row>(sql: string): Promise<{ rows: Row[] }>;
};
const { Client: PgClient } = requireForAudit('pg') as {
  Client: new (config: { connectionString: string }) => PgClientInstance;
};

const FORBIDDEN_OWNER_KEYS = ['clientId', 'companyId', 'ownerId', 'ownerType'];

function hasForbiddenOwnerKey(value: unknown) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      FORBIDDEN_OWNER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

async function main() {
  assert.equal(isEditableVehicleField('model'), true);
  assert.equal(isEditableVehicleField('companyId'), false);
  assert.equal(normalizeEditableVehicleValue('vinOrSerial', ' ab-12 3 '), 'AB123');
  assert.equal(normalizeEditableVehicleValue('year', '2026'), 2026);
  assert.equal(normalizeEditableVehicleValue('year', 'invalid'), undefined);

  const snapshot = {
    name: 'Основний трактор',
    type: 'Трактор',
    manufacturer: 'John Deere',
    model: '6155M',
    year: 2020,
    vinOrSerial: 'VIN1',
    comment: null
  };
  assert.deepEqual(diffVehicleFields(snapshot, snapshot).changedFields, []);
  assert.deepEqual(diffVehicleFields(snapshot, { ...snapshot, model: '6195M' }).changedFields, ['model']);

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');

  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const vehicleAuditCount = await client.query<{ count: string }>(`
    SELECT COUNT(*)::bigint AS count FROM "AuditLog" WHERE "entityType" = 'VEHICLE'
  `);
  const vehicleRequests = await client.query<{ status: string; count: string }>(`
    SELECT status, COUNT(*)::bigint AS count
    FROM "ChangeRequest"
    WHERE "entityType" = 'VEHICLE'
    GROUP BY status
  `);
  const approvedVehicleRequests = await client.query<{
    id: string;
    oldValue: unknown;
    newValue: unknown;
  }>(`
    SELECT id, "oldValue", "newValue"
    FROM "ChangeRequest"
    WHERE "entityType" = 'VEHICLE' AND status = 'APPROVED'
  `);
  const appliedVehicleAudits = await client.query<{ changeRequestId: string }>(`
    SELECT "changeRequestId"
    FROM "AuditLog"
    WHERE "entityType" = 'VEHICLE' AND "changeRequestId" IS NOT NULL
  `);

  const auditedRequestIds = new Set(appliedVehicleAudits.rows.map((item) => item.changeRequestId));
  const result = {
    helperChecks: 'passed',
    vehicleAuditCount: Number(vehicleAuditCount.rows[0]?.count ?? '0'),
    vehicleChangeRequestsByStatus: Object.fromEntries(
      vehicleRequests.rows.map((row) => [row.status, Number(row.count)])
    ),
    forbiddenOwnershipPayloads: approvedVehicleRequests.rows.filter(
      (item) => hasForbiddenOwnerKey(item.oldValue) || hasForbiddenOwnerKey(item.newValue)
    ).length,
    approvedWithoutVehicleAudit: approvedVehicleRequests.rows.filter(
      (item) => !auditedRequestIds.has(item.id)
    ).length
  };

  console.log(JSON.stringify(result, null, 2));
  await client.end();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Stage 10 audit failed.');
    process.exitCode = 1;
  });
