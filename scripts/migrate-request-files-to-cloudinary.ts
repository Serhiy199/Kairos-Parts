import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { config } from 'dotenv';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import { auditSystemActor, writeAuditLog } from '../lib/audit-log/service';
import { readLocalUpload } from '../lib/files/secure-local-file';
import {
  isOcrCompatibleMimeType,
  validateRequestFileBuffer
} from '../lib/files/request-file-validation';
import { prisma } from '../lib/prisma';

config({ path: '.env.local', quiet: true });

const execute = process.argv.includes('--execute');
const batchArgument = process.argv.find((argument) => argument.startsWith('--batch-size='));
const batchSize = Math.min(100, Math.max(1, Number(batchArgument?.split('=', 2)[1] ?? 25) || 25));

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured.');
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
}

async function upload(input: {
  requestId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const resourceType = isOcrCompatibleMimeType(input.mimeType) ? 'image' as const : 'raw' as const;
  const format = path.extname(input.fileName).toLowerCase().replace(/^\./, '');
  const opaqueId = randomUUID();
  const publicId = resourceType === 'raw' && format ? `${opaqueId}.${format}` : opaqueId;
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `kairos-parts/requests/${input.requestId}/files`,
      public_id: publicId,
      resource_type: resourceType,
      type: 'authenticated',
      use_filename: false,
      unique_filename: false,
      overwrite: false,
      ...(resourceType === 'image' ? { allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] } : {})
    }, (error, value) => {
      if (error || !value) reject(error ?? new Error('Cloudinary upload failed.'));
      else resolve(value);
    });
    stream.end(input.buffer);
  });
  return {
    publicId: result.public_id,
    resourceType,
    deliveryType: 'authenticated' as const,
    version: result.version === undefined ? null : String(result.version),
    format: result.format || format || null,
    bytes: result.bytes || input.buffer.byteLength,
    checksumSha256: createHash('sha256').update(input.buffer).digest('hex')
  };
}

async function cleanup(asset: {
  publicId: string;
  resourceType: 'image' | 'raw';
  deliveryType: 'authenticated';
}) {
  const result = await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: asset.resourceType,
    type: asset.deliveryType,
    invalidate: true
  });
  return ['ok', 'not found'].includes(result.result);
}

async function main() {
  if (!execute) {
    console.log(JSON.stringify({
      mode: 'DRY_RUN',
      mutationEnabled: false,
      message: 'Use scripts/audit-request-file-storage.ts for inventory. Pass --execute explicitly to migrate.'
    }, null, 2));
    return;
  }

  configureCloudinary();
  const candidates = await prisma.requestFile.findMany({
    where: {
      storageProvider: 'LEGACY_LOCAL',
      storageStatus: { in: ['MIGRATION_PENDING', 'MIGRATION_FAILED'] },
      storagePublicId: null
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: {
      id: true,
      requestId: true,
      fileName: true,
      storageKey: true,
      mimeType: true,
      size: true
    }
  });

  const summary = {
    mode: 'EXECUTE',
    candidates: candidates.length,
    migrated: 0,
    missing: 0,
    invalid: 0,
    skippedRace: 0,
    failed: 0,
    cleanupFailed: 0
  };

  for (const file of candidates) {
    const local = await readLocalUpload(file.storageKey);
    if (!local.ok) {
      const marked = await prisma.$transaction(async (tx) => {
        const result = await tx.requestFile.updateMany({
          where: {
            id: file.id,
            storageProvider: 'LEGACY_LOCAL',
            storageStatus: { in: ['MIGRATION_PENDING', 'MIGRATION_FAILED'] },
            storagePublicId: null
          },
          data: { storageStatus: 'MISSING' }
        });
        if (result.count === 1) {
          const request = await tx.request.findUnique({
            where: { id: file.requestId },
            select: { companyId: true }
          });
          await writeAuditLog(tx, {
            actor: auditSystemActor('request-file-cloudinary-backfill'),
            companyId: request?.companyId,
            entityType: 'REQUEST_FILE',
            entityId: file.id,
            action: 'REQUEST_FILE_STORAGE_MISSING',
            category: 'TECHNICAL',
            metadata: { requestId: file.requestId, fileId: file.id },
            allowedFields: { metadata: ['requestId', 'fileId'] }
          });
        }
        return result;
      });
      summary.missing += marked.count;
      summary.skippedRace += marked.count === 0 ? 1 : 0;
      continue;
    }

    const validation = validateRequestFileBuffer({
      fileName: file.fileName,
      mimeType: file.mimeType,
      buffer: local.buffer
    });
    if (!validation.ok || validation.file.size !== file.size) {
      summary.invalid += 1;
      await prisma.requestFile.updateMany({
        where: {
          id: file.id,
          storageProvider: 'LEGACY_LOCAL',
          storageStatus: { in: ['MIGRATION_PENDING', 'MIGRATION_FAILED'] },
          storagePublicId: null
        },
        data: { storageStatus: 'MIGRATION_FAILED' }
      });
      continue;
    }

    let asset: Awaited<ReturnType<typeof upload>> | null = null;
    try {
      const uploadedAsset = await upload({
        requestId: file.requestId,
        fileName: file.fileName,
        mimeType: validation.file.mimeType,
        buffer: validation.file.buffer
      });
      asset = uploadedAsset;
      if (uploadedAsset.bytes !== validation.file.size) {
        throw new Error('Cloudinary byte count mismatch.');
      }
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.requestFile.updateMany({
          where: {
            id: file.id,
            storageProvider: 'LEGACY_LOCAL',
            storageStatus: { in: ['MIGRATION_PENDING', 'MIGRATION_FAILED'] },
            storagePublicId: null
          },
          data: {
            storageProvider: 'CLOUDINARY',
            storageStatus: 'AVAILABLE',
            storageKey: `cloudinary-request-file:${Buffer.from(JSON.stringify({
              publicId: uploadedAsset.publicId,
              resourceType: uploadedAsset.resourceType,
              deliveryType: uploadedAsset.deliveryType,
              version: uploadedAsset.version,
              format: uploadedAsset.format
            }), 'utf8').toString('base64url')}`,
            storagePublicId: uploadedAsset.publicId,
            storageResourceType: uploadedAsset.resourceType,
            storageDeliveryType: uploadedAsset.deliveryType,
            storageVersion: uploadedAsset.version,
            storageFormat: uploadedAsset.format,
            storageChecksumSha256: uploadedAsset.checksumSha256,
            migratedAt: new Date()
          }
        });
        if (result.count === 1) {
          const request = await tx.request.findUnique({
            where: { id: file.requestId },
            select: { companyId: true }
          });
          await writeAuditLog(tx, {
            actor: auditSystemActor('request-file-cloudinary-backfill'),
            companyId: request?.companyId,
            entityType: 'REQUEST_FILE',
            entityId: file.id,
            action: 'REQUEST_FILE_STORAGE_MIGRATED',
            category: 'STANDARD',
            metadata: {
              requestId: file.requestId,
              fileId: file.id,
              storageProvider: 'CLOUDINARY'
            },
            allowedFields: {
              metadata: ['requestId', 'fileId', 'storageProvider']
            }
          });
        }
        return result;
      });
      if (updated.count === 0) {
        summary.skippedRace += 1;
        if (!(await cleanup(uploadedAsset))) summary.cleanupFailed += 1;
      } else {
        summary.migrated += 1;
      }
    } catch (error) {
      summary.failed += 1;
      if (asset && !(await cleanup(asset).catch(() => false))) {
        summary.cleanupFailed += 1;
      }
      await prisma.requestFile.updateMany({
        where: {
          id: file.id,
          storageProvider: 'LEGACY_LOCAL',
          storageStatus: { in: ['MIGRATION_PENDING', 'MIGRATION_FAILED'] },
          storagePublicId: null
        },
        data: { storageStatus: 'MIGRATION_FAILED' }
      });
      console.error('RequestFile backfill item failed', {
        fileId: file.id,
        requestId: file.requestId,
        reason: error instanceof Error ? error.name : 'unknown'
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('RequestFile Cloudinary migration failed', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
