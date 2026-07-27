-- Add immutable request selection approval-cycle persistence.
CREATE TYPE "RequestSelectionBatchStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE "RequestSelectionBatchItemStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TYPE "AuditEntityType"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH';

ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH_CREATED';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH_SENT';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH_APPROVED';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH_REJECTED';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH_SUPERSEDED';

ALTER TABLE "Request"
  ADD COLUMN "selectionRevisionCounter" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_selectionRevisionCounter_check"
  CHECK ("selectionRevisionCounter" >= 0);

CREATE TABLE "RequestSelectionBatch" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "RequestSelectionBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "snapshotSchemaVersion" INTEGER NOT NULL,
  "snapshotHash" CHAR(64) NOT NULL,
  "createdByUserId" TEXT,
  "sentAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RequestSelectionBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RequestSelectionBatch_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "RequestSelectionBatch_snapshotSchemaVersion_check" CHECK ("snapshotSchemaVersion" >= 1),
  CONSTRAINT "RequestSelectionBatch_snapshotHash_check" CHECK ("snapshotHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "RequestSelectionBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceRequestItemId" TEXT,
  "position" INTEGER NOT NULL,
  "status" "RequestSelectionBatchItemStatus" NOT NULL DEFAULT 'PENDING',
  "decisionByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "clientComment" TEXT,
  "snapshotSchemaVersion" INTEGER NOT NULL,
  "snapshotHash" CHAR(64) NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "equipmentType" TEXT,
  "itemName" TEXT NOT NULL,
  "brand" TEXT,
  "catalogNumber" TEXT,
  "analogNumber" TEXT,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT NOT NULL,
  "availability" TEXT,
  "deliveryTime" TEXT,
  "approvedUnitPrice" DECIMAL(12,2),
  "currency" TEXT NOT NULL,
  "managerComment" TEXT,
  "vehicleIdSnapshot" TEXT,
  "vehicleDisplayName" TEXT,
  "vehicleBrand" TEXT,
  "vehicleModel" TEXT,
  "vehicleYear" INTEGER,
  "vehicleVin" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RequestSelectionBatchItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RequestSelectionBatchItem_position_check" CHECK ("position" >= 1),
  CONSTRAINT "RequestSelectionBatchItem_quantity_check" CHECK ("quantity" >= 1),
  CONSTRAINT "RequestSelectionBatchItem_approvedUnitPrice_check" CHECK (
    "approvedUnitPrice" IS NULL OR "approvedUnitPrice" >= 0
  ),
  CONSTRAINT "RequestSelectionBatchItem_snapshotSchemaVersion_check" CHECK ("snapshotSchemaVersion" >= 1),
  CONSTRAINT "RequestSelectionBatchItem_snapshotHash_check" CHECK ("snapshotHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "RequestSelectionBatch_requestId_revision_key"
  ON "RequestSelectionBatch"("requestId", "revision");

CREATE INDEX "RequestSelectionBatch_requestId_status_idx"
  ON "RequestSelectionBatch"("requestId", "status");

CREATE INDEX "RequestSelectionBatch_createdByUserId_idx"
  ON "RequestSelectionBatch"("createdByUserId");

CREATE INDEX "RequestSelectionBatch_createdAt_idx"
  ON "RequestSelectionBatch"("createdAt");

-- PostgreSQL partial unique index is the database source of truth for one active SENT cycle.
CREATE UNIQUE INDEX "RequestSelectionBatch_one_sent_per_request"
  ON "RequestSelectionBatch"("requestId")
  WHERE "status" = 'SENT';

CREATE UNIQUE INDEX "RequestSelectionBatchItem_batchId_position_key"
  ON "RequestSelectionBatchItem"("batchId", "position");

-- PostgreSQL permits multiple NULL source IDs; orphaned immutable snapshots remain valid.
CREATE UNIQUE INDEX "RequestSelectionBatchItem_batchId_sourceRequestItemId_key"
  ON "RequestSelectionBatchItem"("batchId", "sourceRequestItemId");

CREATE INDEX "RequestSelectionBatchItem_batchId_status_idx"
  ON "RequestSelectionBatchItem"("batchId", "status");

CREATE INDEX "RequestSelectionBatchItem_sourceRequestItemId_idx"
  ON "RequestSelectionBatchItem"("sourceRequestItemId");

CREATE INDEX "RequestSelectionBatchItem_snapshotHash_idx"
  ON "RequestSelectionBatchItem"("snapshotHash");

CREATE INDEX "RequestSelectionBatchItem_decisionByUserId_idx"
  ON "RequestSelectionBatchItem"("decisionByUserId");

ALTER TABLE "RequestSelectionBatch"
  ADD CONSTRAINT "RequestSelectionBatch_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestSelectionBatch"
  ADD CONSTRAINT "RequestSelectionBatch_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RequestSelectionBatchItem"
  ADD CONSTRAINT "RequestSelectionBatchItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "RequestSelectionBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestSelectionBatchItem"
  ADD CONSTRAINT "RequestSelectionBatchItem_sourceRequestItemId_fkey"
  FOREIGN KEY ("sourceRequestItemId") REFERENCES "RequestItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RequestSelectionBatchItem"
  ADD CONSTRAINT "RequestSelectionBatchItem_decisionByUserId_fkey"
  FOREIGN KEY ("decisionByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
