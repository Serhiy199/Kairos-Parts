-- CreateTable
CREATE TABLE "RequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "analogNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "supplierName" TEXT,
    "availability" TEXT,
    "deliveryTime" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "comment" TEXT,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "approvedByClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestItem_requestId_idx" ON "RequestItem"("requestId");

-- CreateIndex
CREATE INDEX "RequestItem_vehicleId_idx" ON "RequestItem"("vehicleId");

-- CreateIndex
CREATE INDEX "RequestItem_visibleToClient_idx" ON "RequestItem"("visibleToClient");

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
