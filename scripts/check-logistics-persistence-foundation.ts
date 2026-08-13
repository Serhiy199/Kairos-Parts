import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LOGISTICS_TARIFF_CITIES } from '../lib/logistics/tariff-cities';

const SCHEMA_PATH = 'prisma/schema.prisma';
const MIGRATION_PATH =
  'prisma/migrations/20260729120000_add_logistics_persistence_foundation/migration.sql';

const schema = readFileSync(SCHEMA_PATH, 'utf8');
const migration = readFileSync(MIGRATION_PATH, 'utf8');

function extractPrismaBlock(kind: 'enum' | 'model', name: string) {
  const match = schema.match(new RegExp(`${kind}\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing Prisma ${kind}: ${name}`);
  return match[1];
}

function prismaBlockValues(block: string) {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line) => line.split(/\s+/, 1)[0]);
}

function assertIncludesAll(haystack: string, values: readonly string[]) {
  for (const value of values) {
    assert.ok(haystack.includes(value), `Missing required value: ${value}`);
  }
}

const expectedStatuses = ['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const expectedDestinationTypes = ['KAIROS_BASE', 'FARM'];
const expectedProviders = ['MOCK', 'GOOGLE', 'MANUAL'];

assert.deepEqual(
  prismaBlockValues(extractPrismaBlock('enum', 'LogisticsRequestStatus')),
  expectedStatuses
);
assert.deepEqual(
  prismaBlockValues(extractPrismaBlock('enum', 'LogisticsDestinationType')),
  expectedDestinationTypes
);
assert.deepEqual(
  prismaBlockValues(extractPrismaBlock('enum', 'LogisticsAddressProvider')),
  expectedProviders
);

const auditEntityType = extractPrismaBlock('enum', 'AuditEntityType');
assertIncludesAll(auditEntityType, [
  'LOGISTICS_REQUEST',
  'LOGISTICS_TARIFF_CITY'
]);

const auditAction = extractPrismaBlock('enum', 'AuditAction');
assertIncludesAll(auditAction, [
  'LOGISTICS_REQUEST_CREATED',
  'LOGISTICS_STATUS_CHANGED',
  'LOGISTICS_INTERNAL_COMMENT_CREATED',
  'LOGISTICS_TARIFF_UPDATED'
]);

const tariffCityModel = extractPrismaBlock('model', 'LogisticsTariffCity');
const logisticsRequestModel = extractPrismaBlock('model', 'LogisticsRequest');
const pickupPointModel = extractPrismaBlock('model', 'LogisticsPickupPoint');
const internalCommentModel = extractPrismaBlock(
  'model',
  'LogisticsInternalComment'
);

assert.doesNotMatch(schema, /model\s+LogisticsStatusHistory\s+\{/);
assert.match(tariffCityModel, /code\s+String\s+@unique/);
assert.match(tariffCityModel, /price\s+Decimal\s+@db\.Decimal\(12,\s*2\)/);
assert.match(tariffCityModel, /isActive\s+Boolean\s+@default\(true\)/);

assert.match(logisticsRequestModel, /requestNumber\s+String\s+@unique/);
assert.match(
  logisticsRequestModel,
  /requestNumber[\s\S]*logistics_request_number_seq/
);
assert.match(logisticsRequestModel, /clientId\s+String\?/);
assert.match(logisticsRequestModel, /companyId\s+String\?/);
assert.match(logisticsRequestModel, /idempotencyKey\s+String\s+@unique/);
assertIncludesAll(logisticsRequestModel, [
  'tariffCityCodeSnapshot',
  'tariffCityNameSnapshot',
  'baseTariffSnapshot',
  'destinationType',
  'baseAddressSnapshot',
  'farmFormattedAddress',
  'farmExternalAddressId',
  'farmAddressProvider',
  'farmNormalizedLocality',
  'pickupPointCount',
  'additionalPointsCharge',
  'farmDeliveryCharge',
  'totalPrice',
  'clientComment'
]);

for (const field of [
  'baseTariffSnapshot',
  'additionalPointsCharge',
  'farmDeliveryCharge',
  'totalPrice'
]) {
  assert.match(
    logisticsRequestModel,
    new RegExp(`${field}\\s+Decimal\\?\\s+@db\\.Decimal\\(12,\\s*2\\)`)
  );
}

assert.match(
  logisticsRequestModel,
  /tariffCity[\s\S]*onDelete:\s*Restrict/
);
assert.match(logisticsRequestModel, /client[\s\S]*onDelete:\s*SetNull/);
assert.match(logisticsRequestModel, /company[\s\S]*onDelete:\s*SetNull/);
assert.match(
  pickupPointModel,
  /logisticsRequest[\s\S]*onDelete:\s*Cascade/
);
assert.match(
  internalCommentModel,
  /logisticsRequest[\s\S]*onDelete:\s*Cascade/
);
assert.match(internalCommentModel, /author[\s\S]*onDelete:\s*SetNull/);
assert.match(internalCommentModel, /body\s+String\s+@db\.Text/);

assertIncludesAll(pickupPointModel, [
  'formattedAddress',
  'externalAddressId',
  'addressProvider',
  'normalizedLocality',
  'normalizedAdministrativeArea',
  'cargoDescription'
]);
assert.doesNotMatch(pickupPointModel, /\b(displayOrder|sequence)\b/);

const forbiddenFieldNames = new Set([
  'latitude',
  'longitude',
  'distance',
  'duration',
  'route',
  'confirmedPrice',
  'finalPrice',
  'pricingStatus',
  'priceOverride',
  'assignedManager',
  'assignedManagerId',
  'supplierPhone',
  'receiverPhone'
]);

for (const block of [
  tariffCityModel,
  logisticsRequestModel,
  pickupPointModel,
  internalCommentModel
]) {
  const fieldNames = prismaBlockValues(block);
  for (const forbiddenField of forbiddenFieldNames) {
    assert.ok(
      !fieldNames.includes(forbiddenField),
      `Forbidden Logistics field found: ${forbiddenField}`
    );
  }
}

assert.doesNotMatch(logisticsRequestModel, /\bvatIncluded\b/);
assert.match(migration, /CREATE SEQUENCE "logistics_request_number_seq"/);
assert.match(
  migration,
  /OWNED BY "LogisticsRequest"\."requestNumber"/
);
assert.match(
  migration,
  /"LogisticsRequest_company_requires_client_check"/
);
assert.match(
  migration,
  /"LogisticsRequest_destination_consistency_check"/
);
assert.match(
  migration,
  /"LogisticsRequest_amounts_non_negative_check"/
);
assert.match(
  migration,
  /"LogisticsRequest_pickup_point_count_check"/
);
assert.match(
  migration,
  /"LogisticsTariffCity_price_non_negative_check"/
);
assert.match(
  migration,
  /CREATE INDEX "LogisticsRequest_status_createdAt_idx"/
);
assert.match(
  migration,
  /CREATE INDEX "LogisticsRequest_clientId_createdAt_idx"/
);
assert.match(
  migration,
  /CREATE INDEX "LogisticsRequest_companyId_createdAt_idx"/
);
assert.match(
  migration,
  /CREATE INDEX "LogisticsInternalComment_logisticsRequestId_createdAt_idx"/
);

assert.doesNotMatch(
  migration,
  /\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+"/i
);
assert.doesNotMatch(
  migration,
  /\b(latitude|longitude|distance|duration|routeData|mapUrl)\b/i
);

const initialTariffSection = migration.match(
  /INSERT INTO "LogisticsTariffCity"([\s\S]*?);/
);
assert.ok(initialTariffSection, 'Missing initial Logistics tariff insert.');

const tariffRowPattern =
  /\('([^']+)', '([^']+)', '([^']+)', ([0-9]+\.[0-9]{2}), true,/g;
const migrationTariffs = Array.from(
  initialTariffSection[0].matchAll(tariffRowPattern),
  (match) => ({
    id: match[1],
    code: match[2],
    name: match[3],
    price: match[4]
  })
);

const expectedPrices = new Map([
  ['MYRONIVKA', '1600.00'],
  ['OBUKHIV', '1700.00'],
  ['UZYN', '1800.00'],
  ['VASYLKIV', '2000.00'],
  ['BILA_TSERKVA', '2200.00'],
  ['BORYSPIL', '2400.00'],
  ['KYIV_RIGHT_BANK', '2500.00'],
  ['KYIV_LEFT_BANK', '2600.00'],
  ['BROVARY', '2700.00'],
  ['IRPIN', '2900.00'],
  ['BUCHA', '2900.00'],
  ['BEREZAN', '3000.00'],
  ['VYSHHOROD', '3200.00']
]);

assert.equal(migrationTariffs.length, 13);
assert.equal(new Set(migrationTariffs.map((tariff) => tariff.id)).size, 13);
assert.equal(new Set(migrationTariffs.map((tariff) => tariff.code)).size, 13);
assert.deepEqual(
  migrationTariffs.map(({ code, name }) => ({ code, name })),
  LOGISTICS_TARIFF_CITIES.map(({ code, displayName }) => ({
    code,
    name: displayName
  }))
);

for (const tariff of migrationTariffs) {
  assert.equal(tariff.price, expectedPrices.get(tariff.code));
}

assert.ok(
  migrationTariffs.some((tariff) => tariff.code === 'IRPIN') &&
    migrationTariffs.some((tariff) => tariff.code === 'BUCHA')
);
assert.ok(!migrationTariffs.some((tariff) => tariff.price === '500.00'));

console.log(
  `logisticsPersistenceFoundation=PASS models=4 cities=${migrationTariffs.length} constraints=7`
);
