ALTER TABLE "RequestItem" ADD COLUMN "includeInInvoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RequestItem" ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE INDEX "RequestItem_includeInInvoice_idx" ON "RequestItem"("includeInInvoice");
