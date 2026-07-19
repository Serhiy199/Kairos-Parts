-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "uploadedById" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Vehicle documents are owned by the vehicle record.
ALTER TABLE "Document" DROP CONSTRAINT "Document_vehicleId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Document_vehicleId_visibleToClient_idx" ON "Document"("vehicleId", "visibleToClient");
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");
