ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'REQUEST_SELECTION_BATCH_PARTIALLY_APPROVED';

ALTER TABLE "Invoice"
  ADD COLUMN "selectionBatchId" TEXT;

ALTER TABLE "InvoiceItem"
  ADD COLUMN "selectionBatchItemId" TEXT;

CREATE UNIQUE INDEX "Invoice_selectionBatchId_key"
  ON "Invoice"("selectionBatchId");
CREATE INDEX "Invoice_selectionBatchId_idx"
  ON "Invoice"("selectionBatchId");

CREATE UNIQUE INDEX "InvoiceItem_selectionBatchItemId_key"
  ON "InvoiceItem"("selectionBatchItemId");
CREATE INDEX "InvoiceItem_selectionBatchItemId_idx"
  ON "InvoiceItem"("selectionBatchItemId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_selectionBatchId_fkey"
  FOREIGN KEY ("selectionBatchId")
  REFERENCES "RequestSelectionBatch"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_selectionBatchItemId_fkey"
  FOREIGN KEY ("selectionBatchItemId")
  REFERENCES "RequestSelectionBatchItem"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
