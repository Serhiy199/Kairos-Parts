import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { config } from 'dotenv';

import { hasExactlyOneDocumentOwner } from '../lib/documents/ownership';
import {
  diffVehicleFields,
  isEditableVehicleField,
  normalizeEditableVehicleValue
} from '../lib/vehicles/change-snapshot';
import { isValidVehicleOwnership, vehicleAccessWhereForClient } from '../lib/vehicles/ownership';
import { isWeakVehicleVin, normalizeVehicleVin } from '../lib/vehicles/vin';

config({ path: '.env.local', quiet: true });

if (process.env.DATABASE_URL_UNPOOLED) {
  const databaseUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
  databaseUrl.searchParams.delete('channel_binding');
  databaseUrl.searchParams.set('sslmode', 'verify-full');
  process.env.DATABASE_URL = databaseUrl.toString();
}

const FORBIDDEN_CHANGE_KEYS = new Set(['clientId', 'companyId', 'ownerId', 'ownerType']);
const SENSITIVE_AUDIT_KEYS = /storagekey|publicid|secureurl|signedurl|token|secret|password|database_url/i;
const requireForAudit = createRequire(import.meta.url);

type PgQueryResult<Row> = { rows: Row[] };
type PgClientInstance = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row>(sql: string): Promise<PgQueryResult<Row>>;
};
type PgClientConstructor = new (config: { connectionString: string }) => PgClientInstance;

const { Client: PgClient } = requireForAudit('pg') as { Client: PgClientConstructor };

function objectHasKey(value: unknown, keys: Set<string>): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => objectHasKey(item, keys));

  return Object.entries(value).some(([key, nested]) => keys.has(key) || objectHasKey(nested, keys));
}

function objectHasSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(objectHasSensitiveKey);

  return Object.entries(value).some(
    ([key, nested]) => SENSITIVE_AUDIT_KEYS.test(key) || objectHasSensitiveKey(nested)
  );
}

function runHelperChecks() {
  assert.equal(isValidVehicleOwnership({ clientId: 'client', companyId: null }), true);
  assert.equal(isValidVehicleOwnership({ clientId: null, companyId: 'company' }), true);
  assert.equal(isValidVehicleOwnership({ clientId: null, companyId: null }), false);
  assert.equal(isValidVehicleOwnership({ clientId: 'client', companyId: 'company' }), false);

  assert.equal(hasExactlyOneDocumentOwner({ vehicleId: 'vehicle' }), true);
  assert.equal(hasExactlyOneDocumentOwner({ companyId: 'company' }), true);
  assert.equal(hasExactlyOneDocumentOwner({}), false);
  assert.equal(hasExactlyOneDocumentOwner({ clientId: 'client', companyId: 'company' }), false);

  assert.equal(normalizeVehicleVin(' ab-12 3 '), 'AB123');
  assert.equal(normalizeVehicleVin('не вказано'), null);
  assert.equal(isWeakVehicleVin('N/A'), true);

  assert.equal(isEditableVehicleField('model'), true);
  assert.equal(isEditableVehicleField('companyId'), false);
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

  assert.deepEqual(vehicleAccessWhereForClient({ clientProfileId: 'client', companyId: null }), {
    clientId: 'client',
    companyId: null
  });
  assert.deepEqual(vehicleAccessWhereForClient({ clientProfileId: 'client', companyId: 'company' }), {
    OR: [
      { companyId: 'company', clientId: null },
      { clientId: 'client', companyId: null }
    ]
  });
}

async function main() {
  runHelperChecks();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const vehicles = await client.query<{
    id: string;
    clientId: string | null;
    companyId: string | null;
    vinOrSerial: string | null;
  }>(`SELECT id, "clientId", "companyId", "vinOrSerial" FROM "Vehicle"`);
  const documents = await client.query<{
    vehicleId: string | null;
    companyId: string | null;
    clientId: string | null;
    requestId: string | null;
  }>(`SELECT "vehicleId", "companyId", "clientId", "requestId" FROM "Document"`);
  const images = await client.query<{ vehicleId: string; sortOrder: number; isPrimary: boolean }>(
    `SELECT "vehicleId", "sortOrder", "isPrimary" FROM "VehicleImage"`
  );
  const vehicleChangeRequests = await client.query<{
      id: string;
      entityId: string;
      fieldName: string | null;
      status: string;
      reviewedById: string | null;
      reviewedAt: Date | null;
      oldValue: unknown;
      newValue: unknown;
    }>(`
    SELECT id, "entityId", "fieldName", status, "reviewedById", "reviewedAt", "oldValue", "newValue"
    FROM "ChangeRequest"
    WHERE "entityType" = 'VEHICLE'
  `);
  const vehicleAudits = await client.query<{
    actorId: string | null;
    changeRequestId: string | null;
    metadata: unknown;
  }>(`
      SELECT "actorId", "changeRequestId", metadata
      FROM "AuditLog"
      WHERE "entityType" = 'VEHICLE'
  `);
  const constraints = await client.query<{ conname: string }>(`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN ('Vehicle_exactly_one_owner_check', 'Document_exactly_one_owner_check')
      ORDER BY conname
  `);
  const duplicateVinGroups = await client.query<{ duplicate_groups: string }>(`
      SELECT COUNT(*)::bigint AS duplicate_groups
      FROM (
        SELECT "clientId", "companyId", "vinOrSerial"
        FROM "Vehicle"
        WHERE "vinOrSerial" IS NOT NULL AND BTRIM("vinOrSerial") <> ''
        GROUP BY "clientId", "companyId", "vinOrSerial"
        HAVING COUNT(*) > 1
      ) duplicates
  `);

  const vehicleRows = vehicles.rows;
  const documentRows = documents.rows;
  const imageRows = images.rows;
  const changeRequestRows = vehicleChangeRequests.rows;
  const auditRows = vehicleAudits.rows;

  const imageGroups = new Map<string, Array<{ sortOrder: number; isPrimary: boolean }>>();
  for (const image of imageRows) {
    const group = imageGroups.get(image.vehicleId) ?? [];
    group.push(image);
    imageGroups.set(image.vehicleId, group);
  }

  const auditedRequestIds = new Set(
    auditRows.map((audit) => audit.changeRequestId).filter((id): id is string => Boolean(id))
  );
  const pendingKeys = new Set<string>();
  let duplicatePendingRequests = 0;
  for (const request of changeRequestRows.filter((item) => item.status === 'PENDING')) {
    const key = `${request.entityId}:${request.fieldName ?? ''}`;
    if (pendingKeys.has(key)) duplicatePendingRequests += 1;
    pendingKeys.add(key);
  }

  const result = {
    mode: 'read-only',
    connection: process.env.DATABASE_URL_UNPOOLED ? 'unpooled' : 'default',
    helperChecks: 'passed',
    databaseConstraints: constraints.rows.map((constraint) => constraint.conname),
    vehicles: {
      total: vehicleRows.length,
      personal: vehicleRows.filter((vehicle) => vehicle.clientId && !vehicle.companyId).length,
      company: vehicleRows.filter((vehicle) => vehicle.companyId && !vehicle.clientId).length,
      invalidOwnership: vehicleRows.filter((vehicle) => !isValidVehicleOwnership(vehicle)).length,
      duplicateVinGroups: Number(duplicateVinGroups.rows[0]?.duplicate_groups ?? '0')
    },
    images: {
      total: imageRows.length,
      vehiclesWithImages: imageGroups.size,
      multiplePrimaryGroups: [...imageGroups.values()].filter(
        (group) => group.filter((image) => image.isPrimary).length > 1
      ).length,
      missingPrimaryGroups: [...imageGroups.values()].filter(
        (group) => group.length > 0 && !group.some((image) => image.isPrimary)
      ).length,
      duplicateSortOrderGroups: [...imageGroups.values()].filter(
        (group) => new Set(group.map((image) => image.sortOrder)).size !== group.length
      ).length
    },
    documents: {
      total: documentRows.length,
      invalidOwnership: documentRows.filter((document) => !hasExactlyOneDocumentOwner(document)).length
    },
    changeRequests: {
      total: changeRequestRows.length,
      byStatus: Object.fromEntries(
        ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status) => [
          status,
          changeRequestRows.filter((request) => request.status === status).length
        ])
      ),
      forbiddenOwnershipPayloads: changeRequestRows.filter(
        (request) => objectHasKey(request.oldValue, FORBIDDEN_CHANGE_KEYS)
          || objectHasKey(request.newValue, FORBIDDEN_CHANGE_KEYS)
      ).length,
      unknownEditableFields: changeRequestRows.filter(
        (request) => request.fieldName !== null && !isEditableVehicleField(request.fieldName)
      ).length,
      duplicatePendingRequests,
      reviewedWithoutReviewer: changeRequestRows.filter(
        (request) => request.status !== 'PENDING' && (!request.reviewedById || !request.reviewedAt)
      ).length,
      approvedWithoutAudit: changeRequestRows.filter(
        (request) => request.status === 'APPROVED' && !auditedRequestIds.has(request.id)
      ).length
    },
    auditLogs: {
      vehicleEvents: auditRows.length,
      missingActor: auditRows.filter((audit) => !audit.actorId).length,
      sensitiveMetadataKeys: auditRows.filter((audit) => objectHasSensitiveKey(audit.metadata)).length
    }
  };

  console.log(JSON.stringify(result, null, 2));
  await client.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Stage 11 audit failed.');
  process.exitCode = 1;
});
