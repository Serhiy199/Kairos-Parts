import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

import { config } from 'dotenv';

import { EQUIPMENT_MANUFACTURERS_BY_TYPE } from '../lib/vehicles/equipment-manufacturers';
import { EQUIPMENT_TYPE_OPTIONS } from '../lib/vehicles/equipment-types';
import { normalizeTaxonomyName, taxonomySlug } from '../lib/vehicles/taxonomy-normalization';

config({ path: '.env.local', quiet: true });

if (process.env.DATABASE_URL_UNPOOLED) {
  const databaseUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
  databaseUrl.searchParams.delete('channel_binding');
  databaseUrl.searchParams.set('sslmode', 'verify-full');
  process.env.DATABASE_URL = databaseUrl.toString();
}

const requireForBackfill = createRequire(import.meta.url);
type PgResult<Row> = { rows: Row[] };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<PgResult<Row>>;
};
type PgClientConstructor = new (config: { connectionString: string }) => PgClient;
const { Client } = requireForBackfill('pg') as { Client: PgClientConstructor };

function uniqueSlug(base: string, occupied: Set<string>) {
  let slug = base;
  let suffix = 2;
  while (occupied.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  occupied.add(slug);
  return slug;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');
    const vehicleTypes = await client.query<{ value: string }>('SELECT DISTINCT BTRIM(type) AS value FROM "Vehicle" WHERE BTRIM(type) <> \'\'');
    const requestTypes = await client.query<{ value: string }>('SELECT DISTINCT BTRIM("equipmentType") AS value FROM "Request" WHERE "equipmentType" IS NOT NULL AND BTRIM("equipmentType") <> \'\'');
    const usedEquipmentTypes = await client.query<{ value: string }>('SELECT DISTINCT BTRIM("equipmentType") AS value FROM "UsedEquipment" WHERE BTRIM("equipmentType") <> \'\'');
    const vehicleManufacturers = await client.query<{ value: string }>('SELECT DISTINCT BTRIM(manufacturer) AS value FROM "Vehicle" WHERE BTRIM(manufacturer) <> \'\'');
    const existingManufacturers = await client.query<{ id: string; name: string; slug: string }>('SELECT id, name, slug FROM "Manufacturer" ORDER BY "createdAt" ASC');
    const existingTypes = await client.query<{ id: string; name: string; normalizedName: string; slug: string }>('SELECT id, name, "normalizedName", slug FROM "EquipmentType" ORDER BY "createdAt" ASC');

    const typeNames = [...new Set([
      ...EQUIPMENT_TYPE_OPTIONS,
      ...vehicleTypes.rows.map((row) => row.value),
      ...requestTypes.rows.map((row) => row.value),
      ...usedEquipmentTypes.rows.map((row) => row.value)
    ].map((value) => value.trim()).filter(Boolean))];

    const occupiedTypeSlugs = new Set(existingTypes.rows.map((row) => row.slug));
    const types = new Map(existingTypes.rows.map((row) => [row.normalizedName, row]));
    for (const [index, name] of typeNames.entries()) {
      const normalizedName = normalizeTaxonomyName(name);
      if (types.has(normalizedName)) continue;
      const row = {
        id: randomUUID(),
        name,
        normalizedName,
        slug: uniqueSlug(taxonomySlug(name), occupiedTypeSlugs)
      };
      await client.query(
        'INSERT INTO "EquipmentType" (id, name, "normalizedName", slug, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
        [row.id, row.name, row.normalizedName, row.slug, index]
      );
      types.set(normalizedName, row);
    }

    const manufacturerNames = [...new Set([
      ...Object.values(EQUIPMENT_MANUFACTURERS_BY_TYPE).flat(),
      ...vehicleManufacturers.rows.map((row) => row.value),
      ...existingManufacturers.rows.map((row) => row.name)
    ].map((value) => value.trim()).filter(Boolean))];
    const occupiedManufacturerSlugs = new Set(existingManufacturers.rows.map((row) => row.slug));
    const manufacturers = new Map<string, { id: string; name: string; slug: string }>();
    existingManufacturers.rows.forEach((row) => {
      const key = normalizeTaxonomyName(row.name);
      if (!manufacturers.has(key)) manufacturers.set(key, row);
    });
    for (const name of manufacturerNames) {
      const key = normalizeTaxonomyName(name);
      if (manufacturers.has(key)) continue;
      const row = { id: randomUUID(), name, slug: uniqueSlug(taxonomySlug(name), occupiedManufacturerSlugs) };
      await client.query(
        'INSERT INTO "Manufacturer" (id, name, slug, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, 0, NOW(), NOW())',
        [row.id, row.name, row.slug]
      );
      manufacturers.set(key, row);
    }

    let documentedRelationsProcessed = 0;
    for (const [typeName, names] of Object.entries(EQUIPMENT_MANUFACTURERS_BY_TYPE)) {
      const equipmentType = types.get(normalizeTaxonomyName(typeName));
      if (!equipmentType) continue;
      for (const name of new Set(names)) {
        const manufacturer = manufacturers.get(normalizeTaxonomyName(name));
        if (!manufacturer) continue;
        await client.query(
          'INSERT INTO "ManufacturerEquipmentType" ("manufacturerId", "equipmentTypeId", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
          [manufacturer.id, equipmentType.id]
        );
        documentedRelationsProcessed += 1;
      }
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      mode: 'controlled-backfill',
      equipmentTypes: types.size,
      manufacturers: manufacturers.size,
      documentedRelationsProcessed
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Equipment taxonomy backfill failed.');
  process.exitCode = 1;
});
