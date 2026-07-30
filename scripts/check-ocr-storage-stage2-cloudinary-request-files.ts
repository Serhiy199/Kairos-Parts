import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  MAX_REQUEST_FILES,
  MAX_REQUEST_FILE_TOTAL_BYTES,
  assertRequestFileQuota,
  isOcrCompatibleMimeType,
  validateRequestFileBuffer
} from '../lib/files/request-file-validation';

function source(filePath: string) {
  return readFileSync(resolve(process.cwd(), filePath), 'utf8');
}

function bytes(...values: number[]) {
  return Buffer.from(values);
}

function validFile(fileName: string, mimeType: string, buffer: Buffer) {
  const result = validateRequestFileBuffer({ fileName, mimeType, buffer });
  assert.equal(result.ok, true, `${fileName} should pass validation`);
  return result;
}

function main() {
  const schema = source('prisma/schema.prisma');
  const migration = source(
    'prisma/migrations/20260730170000_add_request_file_cloudinary_storage/migration.sql'
  );
  const cloudinary = source('lib/files/cloudinary-request-files.ts');
  const uploadService = source('lib/files/request-file-upload-service.ts');
  const storage = source('lib/files/request-file-storage.ts');
  const requestRoute = source('app/api/requests/route.ts');
  const telegram = source('lib/telegram/session.ts');
  const ocr = source('lib/ocr/service.ts');
  const adminDownload = source('app/api/admin/files/[fileId]/route.ts');
  const clientDownload = source('app/api/client/files/[fileId]/route.ts');
  const inventory = source('scripts/audit-request-file-storage.ts');
  const backfill = source('scripts/migrate-request-files-to-cloudinary.ts');

  assert.match(schema, /enum RequestFileStorageProvider[\s\S]*CLOUDINARY[\s\S]*LEGACY_LOCAL/);
  assert.match(schema, /enum RequestFileStorageStatus[\s\S]*AVAILABLE[\s\S]*MISSING[\s\S]*MIGRATION_PENDING[\s\S]*MIGRATION_FAILED/);
  assert.match(schema, /storageProvider\s+RequestFileStorageProvider/);
  assert.match(schema, /storageStatus\s+RequestFileStorageStatus/);
  assert.match(schema, /storagePublicId\s+String\?/);
  assert.match(schema, /storageChecksumSha256\s+String\?/);
  assert.match(schema, /source\s+RequestFileSource/);
  assert.match(schema, /request\s+Request\s+@relation\(fields: \[requestId\],[\s\S]*onDelete: Cascade\)/);
  assert.match(schema, /ocrResults\s+OCRResult\[\]/);

  assert.match(migration, /'LEGACY_LOCAL'::"RequestFileStorageProvider"/);
  assert.match(migration, /'MIGRATION_PENDING'::"RequestFileStorageStatus"/);
  assert.match(migration, /ALTER COLUMN "storageProvider" SET NOT NULL/);
  assert.match(migration, /RequestFile_cloudinary_metadata_check/);
  assert.match(migration, /RequestFile_checksum_sha256_check/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);

  validFile('photo.jpg', 'image/jpeg', bytes(0xff, 0xd8, 0xff, 0x00));
  validFile(
    'photo.png',
    'image/png',
    bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  );
  validFile(
    'photo.webp',
    'image/webp',
    Buffer.from('RIFF0000WEBP', 'ascii')
  );
  validFile('document.pdf', 'application/pdf', Buffer.from('%PDF-1.7', 'ascii'));
  assert.equal(isOcrCompatibleMimeType('image/jpeg'), true);
  assert.equal(isOcrCompatibleMimeType('image/png'), true);
  assert.equal(isOcrCompatibleMimeType('image/webp'), true);
  assert.equal(isOcrCompatibleMimeType('application/pdf'), false);
  assert.equal(
    validateRequestFileBuffer({
      fileName: 'payload.exe.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7', 'ascii')
    }).ok,
    false
  );
  assert.equal(
    validateRequestFileBuffer({
      fileName: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-png')
    }).ok,
    false
  );
  assert.throws(() => assertRequestFileQuota({
    existingCount: MAX_REQUEST_FILES,
    existingBytes: 0,
    files: [{ size: 1 }]
  }));
  assert.throws(() => assertRequestFileQuota({
    existingCount: 0,
    existingBytes: MAX_REQUEST_FILE_TOTAL_BYTES,
    files: [{ size: 1 }]
  }));

  assert.match(cloudinary, /resource_type: resourceType/);
  assert.match(cloudinary, /type: 'authenticated'/);
  assert.match(cloudinary, /randomUUID\(\)/);
  assert.match(cloudinary, /kairos-parts\/requests\/\$\{requestId\}\/files/);
  assert.match(cloudinary, /createHash\('sha256'\)/);
  assert.match(cloudinary, /private_download_url/);
  assert.doesNotMatch(cloudinary, /secureUrl|secure_url:\s/);

  assert.match(uploadService, /uploadRequestFilesForActor/);
  assert.match(uploadService, /storageProvider: 'CLOUDINARY'/);
  assert.match(uploadService, /storageStatus: 'AVAILABLE'/);
  assert.match(uploadService, /cleanupUploadedFiles/);
  assert.match(uploadService, /REQUEST_FILE_ASSET_CLEANUP_FAILED/);
  assert.doesNotMatch(uploadService, /saveRequestFileLocal|saveRequestFileBufferLocal/);

  assert.match(requestRoute, /uploadRequestFilesForActor/);
  assert.doesNotMatch(requestRoute, /saveRequestFileLocal/);
  assert.match(telegram, /uploadRequestFilesForActor/);
  assert.doesNotMatch(telegram, /saveRequestFileBufferLocal/);
  assert.doesNotMatch(telegram, /storageKey:\s*`telegram\//);

  assert.match(storage, /loadRequestFileForProcessing/);
  assert.match(storage, /storageProvider === 'CLOUDINARY'/);
  assert.match(storage, /readLocalUpload/);
  assert.match(storage, /PDF_OCR_NOT_SUPPORTED/);
  assert.match(storage, /MAX_OCR_FILE_BYTES/);
  assert.doesNotMatch(storage, /Cloudinary failed[\s\S]*readLocalUpload/i);

  assert.match(ocr, /loadRequestFileForProcessing/);
  assert.match(ocr, /createWorker\('eng\+ukr'\)/);
  assert.match(ocr, /worker\.recognize\(buffer\)/);
  assert.match(ocr, /OCR_TIMEOUT/);
  assert.doesNotMatch(ocr, /pathExists|storageKeyToLocalPath|process\.cwd\(\).*uploads/);
  assert.doesNotMatch(ocr, /storage failure|локальному сховищі.*rawText/i);

  for (const route of [adminDownload, clientDownload]) {
    assert.match(route, /loadRequestFileBytes/);
    assert.match(route, /X-Content-Type-Options': 'nosniff'/);
    assert.match(route, /Cache-Control': 'private, no-store'/);
    assert.match(route, /Content-Length/);
    assert.doesNotMatch(route, /Response\.redirect|private_download_url|storagePublicId\s*\}/);
  }
  assert.match(clientDownload, /requestAccessWhere/);
  assert.match(adminDownload, /getCrmApiSession/);

  assert.match(inventory, /mode: 'DRY_RUN'/);
  assert.match(inventory, /CLOUDINARY_AVAILABLE/);
  assert.match(inventory, /LEGACY_LOCAL_MISSING/);
  assert.doesNotMatch(inventory, /requestFile\.(update|create|delete)/);
  assert.match(backfill, /process\.argv\.includes\('--execute'\)/);
  assert.match(backfill, /storageProvider: 'LEGACY_LOCAL'/);
  assert.match(backfill, /storageStatus: \{ in: \['MIGRATION_PENDING', 'MIGRATION_FAILED'\] \}/);
  assert.match(backfill, /storagePublicId: null/);
  assert.match(backfill, /updateMany/);
  assert.match(backfill, /REQUEST_FILE_STORAGE_MIGRATED/);
  assert.doesNotMatch(backfill, /\bunlink\b|\bdeleteFile\b/);

  console.log('Stage OCR Storage 2 focused checks passed.');
}

main();
