import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { config } from 'dotenv';

import { normalizeTaxonomyName, taxonomySlug } from '../lib/vehicles/taxonomy-normalization';

config({ path: '.env.local', quiet: true });

if (process.env.DATABASE_URL_UNPOOLED) {
  const databaseUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
  databaseUrl.searchParams.delete('channel_binding');
  databaseUrl.searchParams.set('sslmode', 'verify-full');
  process.env.DATABASE_URL = databaseUrl.toString();
}

const requireForAudit = createRequire(import.meta.url);
type PgResult<Row> = { rows: Row[] };
type PgClient = { connect(): Promise<void>; end(): Promise<void>; query<Row>(sql: string): Promise<PgResult<Row>> };
type PgClientConstructor = new (config: { connectionString: string }) => PgClient;
const { Client } = requireForAudit('pg') as { Client: PgClientConstructor };

async function main() {
  assert.equal(normalizeTaxonomyName('  Міні   трактор  '), 'міні трактор');
  assert.equal(taxonomySlug('Міні-трактори'), 'mini-traktory');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const table = await client.query<{ exists: boolean }>(`SELECT to_regclass('public."EquipmentType"') IS NOT NULL AS exists`);
  const hasTaxonomy = Boolean(table.rows[0]?.exists);
  const base = await client.query<{
    categories: string; manufacturers: string; vehicles: string; requests: string;
    vehicle_types: string; request_types: string; vehicle_manufacturers: string; request_manufacturers: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM "Category")::text AS categories,
      (SELECT COUNT(*) FROM "Manufacturer")::text AS manufacturers,
      (SELECT COUNT(*) FROM "Vehicle")::text AS vehicles,
      (SELECT COUNT(*) FROM "Request")::text AS requests,
      (SELECT COUNT(DISTINCT LOWER(BTRIM(type))) FROM "Vehicle" WHERE BTRIM(type) <> '')::text AS vehicle_types,
      (SELECT COUNT(DISTINCT LOWER(BTRIM("equipmentType"))) FROM "Request" WHERE "equipmentType" IS NOT NULL AND BTRIM("equipmentType") <> '')::text AS request_types,
      (SELECT COUNT(DISTINCT LOWER(BTRIM(manufacturer))) FROM "Vehicle" WHERE BTRIM(manufacturer) <> '')::text AS vehicle_manufacturers,
      (SELECT COUNT(DISTINCT LOWER(BTRIM(m.name))) FROM "Request" r JOIN "Manufacturer" m ON m.id = r."manufacturerId")::text AS request_manufacturers
  `);

  let taxonomy = null;
  if (hasTaxonomy) {
    const result = await client.query<{
      types: string; active_types: string; manufacturers: string; active_manufacturers: string; relations: string;
      duplicate_slugs: string; duplicate_names: string; orphan_relations: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM "EquipmentType")::text AS types,
        (SELECT COUNT(*) FROM "EquipmentType" WHERE "isActive")::text AS active_types,
        (SELECT COUNT(*) FROM "Manufacturer")::text AS manufacturers,
        (SELECT COUNT(*) FROM "Manufacturer" WHERE "isActive")::text AS active_manufacturers,
        (SELECT COUNT(*) FROM "ManufacturerEquipmentType")::text AS relations,
        (SELECT COUNT(*) FROM (SELECT slug FROM "EquipmentType" GROUP BY slug HAVING COUNT(*) > 1) x)::text AS duplicate_slugs,
        (SELECT COUNT(*) FROM (SELECT "normalizedName" FROM "EquipmentType" GROUP BY "normalizedName" HAVING COUNT(*) > 1) x)::text AS duplicate_names,
        (SELECT COUNT(*) FROM "ManufacturerEquipmentType" j LEFT JOIN "Manufacturer" m ON m.id=j."manufacturerId" LEFT JOIN "EquipmentType" t ON t.id=j."equipmentTypeId" WHERE m.id IS NULL OR t.id IS NULL)::text AS orphan_relations
    `);
    taxonomy = Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
  }

  console.log(JSON.stringify({
    mode: 'read-only',
    phase: hasTaxonomy ? 'post-migration' : 'pre-migration',
    base: Object.fromEntries(Object.entries(base.rows[0]).map(([key, value]) => [key, Number(value)])),
    taxonomy
  }, null, 2));
  await client.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Stage 11.1 audit failed.');
  process.exitCode = 1;
});
