import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { config } from 'dotenv';

import { isSafeStorageKey, resolveUploadPath } from '../lib/files/secure-local-file';

config({ path: '.env.local', quiet: true });

type RequestFileRow = {
  id: string;
  storageProvider: 'CLOUDINARY' | 'LEGACY_LOCAL';
  storageStatus: 'AVAILABLE' | 'MISSING' | 'MIGRATION_PENDING' | 'MIGRATION_FAILED';
  storageKey: string;
  storagePublicId: string | null;
  storageResourceType: string | null;
  storageDeliveryType: string | null;
};

type PgClient = {
  connect(): Promise<void>;
  query<T>(sql: string): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

const { Client } = createRequire(import.meta.url)('pg') as {
  Client: new (options: { connectionString: string }) => PgClient;
};

type Classification =
  | 'CLOUDINARY_AVAILABLE'
  | 'LEGACY_LOCAL_AVAILABLE'
  | 'LEGACY_LOCAL_MISSING'
  | 'INVALID_METADATA';

async function classify(file: {
  storageProvider: 'CLOUDINARY' | 'LEGACY_LOCAL';
  storageStatus: 'AVAILABLE' | 'MISSING' | 'MIGRATION_PENDING' | 'MIGRATION_FAILED';
  storageKey: string;
  storagePublicId: string | null;
  storageResourceType: string | null;
  storageDeliveryType: string | null;
}): Promise<Classification> {
  if (file.storageProvider === 'CLOUDINARY') {
    return file.storageStatus === 'AVAILABLE'
      && Boolean(file.storagePublicId)
      && ['image', 'raw'].includes(file.storageResourceType ?? '')
      && file.storageDeliveryType === 'authenticated'
      ? 'CLOUDINARY_AVAILABLE'
      : 'INVALID_METADATA';
  }
  if (!isSafeStorageKey(file.storageKey)) return 'INVALID_METADATA';
  const localPath = resolveUploadPath(file.storageKey);
  if (!localPath) return 'INVALID_METADATA';
  try {
    await stat(localPath);
    return 'LEGACY_LOCAL_AVAILABLE';
  } catch {
    return 'LEGACY_LOCAL_MISSING';
  }
}

async function main() {
  if (process.argv.includes('--execute')) {
    throw new Error('Inventory is dry-run only and does not accept --execute.');
  }

  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED is not configured.');
  }
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query<RequestFileRow>(`
      SELECT
        "id",
        "storageProvider",
        "storageStatus",
        "storageKey",
        "storagePublicId",
        "storageResourceType",
        "storageDeliveryType"
      FROM "RequestFile"
      ORDER BY "id" ASC
    `);
    const ids: Record<Classification, string[]> = {
      CLOUDINARY_AVAILABLE: [],
      LEGACY_LOCAL_AVAILABLE: [],
      LEGACY_LOCAL_MISSING: [],
      INVALID_METADATA: []
    };
    for (const file of result.rows) {
      ids[await classify(file)].push(file.id);
    }

    console.log(JSON.stringify({
      mode: 'DRY_RUN',
      total: result.rows.length,
      counts: Object.fromEntries(
        Object.entries(ids).map(([key, values]) => [key, values.length])
      ),
      ids
    }, null, 2));
  } finally {
    await client.end();
  }
}

main()
  .catch((error) => {
    console.error('RequestFile storage inventory failed', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
    process.exitCode = 1;
  });
