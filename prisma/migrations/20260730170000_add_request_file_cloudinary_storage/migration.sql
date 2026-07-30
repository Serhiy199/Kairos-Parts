-- CreateEnum
CREATE TYPE "RequestFileStorageProvider" AS ENUM ('CLOUDINARY', 'LEGACY_LOCAL');

-- CreateEnum
CREATE TYPE "RequestFileStorageStatus" AS ENUM ('AVAILABLE', 'MISSING', 'MIGRATION_PENDING', 'MIGRATION_FAILED');

-- CreateEnum
CREATE TYPE "RequestFileSource" AS ENUM ('CLIENT_FORM', 'TELEGRAM', 'LEGACY');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUEST_FILE';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_FILE_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_FILE_DOWNLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_FILE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_FILE_STORAGE_MIGRATED';
ALTER TYPE "AuditAction" ADD VALUE 'REQUEST_FILE_STORAGE_MISSING';
ALTER TYPE "AuditAction" ADD VALUE 'OCR_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'OCR_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'OCR_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'OCR_CORRECTED';

-- Add storage metadata as nullable columns before deterministic legacy backfill.
ALTER TABLE "RequestFile"
  ADD COLUMN "storageProvider" "RequestFileStorageProvider",
  ADD COLUMN "storageStatus" "RequestFileStorageStatus",
  ADD COLUMN "storagePublicId" TEXT,
  ADD COLUMN "storageResourceType" TEXT,
  ADD COLUMN "storageDeliveryType" TEXT,
  ADD COLUMN "storageVersion" TEXT,
  ADD COLUMN "storageFormat" TEXT,
  ADD COLUMN "storageChecksumSha256" TEXT,
  ADD COLUMN "source" "RequestFileSource",
  ADD COLUMN "migratedAt" TIMESTAMP(3);

-- Existing rows remain explicit legacy candidates. SQL cannot verify local bytes.
UPDATE "RequestFile" AS file
SET
  "storageProvider" = 'LEGACY_LOCAL'::"RequestFileStorageProvider",
  "storageStatus" = 'MIGRATION_PENDING'::"RequestFileStorageStatus",
  "source" = CASE request."source"
    WHEN 'TELEGRAM'::"RequestSource" THEN 'TELEGRAM'::"RequestFileSource"
    ELSE 'LEGACY'::"RequestFileSource"
  END
FROM "Request" AS request
WHERE request."id" = file."requestId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RequestFile"
    WHERE "storageProvider" IS NULL
       OR "storageStatus" IS NULL
       OR "source" IS NULL
  ) THEN
    RAISE EXCEPTION 'RequestFile storage backfill left required values NULL';
  END IF;
END;
$$;

ALTER TABLE "RequestFile"
  ALTER COLUMN "storageProvider" SET DEFAULT 'LEGACY_LOCAL',
  ALTER COLUMN "storageProvider" SET NOT NULL,
  ALTER COLUMN "storageStatus" SET DEFAULT 'MIGRATION_PENDING',
  ALTER COLUMN "storageStatus" SET NOT NULL,
  ALTER COLUMN "source" SET DEFAULT 'LEGACY',
  ALTER COLUMN "source" SET NOT NULL;

ALTER TABLE "RequestFile"
  ADD CONSTRAINT "RequestFile_cloudinary_metadata_check"
  CHECK (
    "storageProvider" <> 'CLOUDINARY'
    OR (
      "storageStatus" = 'AVAILABLE'
      AND "storagePublicId" IS NOT NULL
      AND "storageResourceType" IN ('image', 'raw')
      AND "storageDeliveryType" = 'authenticated'
    )
  ),
  ADD CONSTRAINT "RequestFile_checksum_sha256_check"
  CHECK (
    "storageChecksumSha256" IS NULL
    OR "storageChecksumSha256" ~ '^[0-9a-f]{64}$'
  );

-- CreateIndex
CREATE INDEX "RequestFile_storageProvider_storageStatus_idx"
  ON "RequestFile"("storageProvider", "storageStatus");

-- CreateIndex
CREATE INDEX "RequestFile_requestId_storageProvider_idx"
  ON "RequestFile"("requestId", "storageProvider");

-- CreateIndex
CREATE INDEX "RequestFile_storagePublicId_idx"
  ON "RequestFile"("storagePublicId");
