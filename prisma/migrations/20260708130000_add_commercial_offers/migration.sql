-- CreateEnum
CREATE TYPE "CommercialOfferStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CommercialOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL,
    "status" "CommercialOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "managerComment" TEXT,
    "clientComment" TEXT,
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialOfferItem" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "requestItemId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "analogNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT DEFAULT 'шт',
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "availability" TEXT,
    "deliveryTime" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialOfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialOffer_offerNumber_key" ON "CommercialOffer"("offerNumber");

-- CreateIndex
CREATE INDEX "CommercialOffer_requestId_idx" ON "CommercialOffer"("requestId");

-- CreateIndex
CREATE INDEX "CommercialOffer_status_idx" ON "CommercialOffer"("status");

-- CreateIndex
CREATE INDEX "CommercialOffer_createdById_idx" ON "CommercialOffer"("createdById");

-- CreateIndex
CREATE INDEX "CommercialOfferItem_offerId_idx" ON "CommercialOfferItem"("offerId");

-- CreateIndex
CREATE INDEX "CommercialOfferItem_requestItemId_idx" ON "CommercialOfferItem"("requestItemId");

-- AddForeignKey
ALTER TABLE "CommercialOffer" ADD CONSTRAINT "CommercialOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialOffer" ADD CONSTRAINT "CommercialOffer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialOfferItem" ADD CONSTRAINT "CommercialOfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CommercialOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialOfferItem" ADD CONSTRAINT "CommercialOfferItem_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "RequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
