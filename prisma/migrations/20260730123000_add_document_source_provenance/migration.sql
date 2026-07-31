-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('CLIENT', 'MANAGER', 'ADMIN', 'SYSTEM', 'LEGACY');

-- Add the provenance column as nullable so existing rows can be backfilled safely.
ALTER TABLE "Document" ADD COLUMN "source" "DocumentSource";

-- Unknown, deleted, guest, or otherwise unresolvable uploaders remain explicitly legacy.
UPDATE "Document"
SET "source" = 'LEGACY'::"DocumentSource";

-- Backfill only from the persisted uploader role. Visibility and owner relations are not provenance.
UPDATE "Document" AS document
SET "source" = CASE uploader."role"
  WHEN 'CLIENT'::"UserRole" THEN 'CLIENT'::"DocumentSource"
  WHEN 'MANAGER'::"UserRole" THEN 'MANAGER'::"DocumentSource"
  WHEN 'ADMIN'::"UserRole" THEN 'ADMIN'::"DocumentSource"
  ELSE 'LEGACY'::"DocumentSource"
END
FROM "User" AS uploader
WHERE document."uploadedById" = uploader."id";

-- Fail the migration instead of silently making an incomplete provenance column required.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Document" WHERE "source" IS NULL) THEN
    RAISE EXCEPTION 'Document.source backfill left NULL rows';
  END IF;
END;
$$;

-- New application writes must always choose the source explicitly.
ALTER TABLE "Document" ALTER COLUMN "source" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_vehicleId_source_idx" ON "Document"("vehicleId", "source");
