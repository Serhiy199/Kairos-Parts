import { stat } from 'node:fs/promises';
import { config } from 'dotenv';

import { isSafeStorageKey, resolveUploadPath } from '../lib/files/secure-local-file';
import { prisma } from '../lib/prisma';

config({ path: '.env.local', quiet: true });

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

  const files = await prisma.requestFile.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      storageProvider: true,
      storageStatus: true,
      storageKey: true,
      storagePublicId: true,
      storageResourceType: true,
      storageDeliveryType: true
    }
  });
  const ids: Record<Classification, string[]> = {
    CLOUDINARY_AVAILABLE: [],
    LEGACY_LOCAL_AVAILABLE: [],
    LEGACY_LOCAL_MISSING: [],
    INVALID_METADATA: []
  };
  for (const file of files) {
    ids[await classify(file)].push(file.id);
  }

  console.log(JSON.stringify({
    mode: 'DRY_RUN',
    total: files.length,
    counts: Object.fromEntries(
      Object.entries(ids).map(([key, values]) => [key, values.length])
    ),
    ids
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('RequestFile storage inventory failed', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
