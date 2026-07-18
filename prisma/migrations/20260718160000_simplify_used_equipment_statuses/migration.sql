-- Simplify used-equipment lifecycle to DRAFT/PUBLISHED/ARCHIVED.
-- Existing RESERVED/SOLD records are preserved as archived records before the enum is replaced.

ALTER TABLE "UsedEquipment" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "UsedEquipment"
SET
  "status" = 'ARCHIVED',
  "archivedAt" = COALESCE("archivedAt", NOW())
WHERE "status" IN ('RESERVED', 'SOLD');

ALTER TYPE "UsedEquipmentStatus" RENAME TO "UsedEquipmentStatus_old";

CREATE TYPE "UsedEquipmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "UsedEquipment"
ALTER COLUMN "status" TYPE "UsedEquipmentStatus"
USING ("status"::text::"UsedEquipmentStatus");

ALTER TABLE "UsedEquipment" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "UsedEquipmentStatus_old";

ALTER TABLE "UsedEquipment"
DROP COLUMN "reservedAt",
DROP COLUMN "soldAt";
