-- CreateEnum
CREATE TYPE "UsedEquipmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UsedEquipmentInquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "UsedEquipment" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "manufacturerName" TEXT NOT NULL,
    "model" TEXT,
    "year" INTEGER,
    "description" TEXT NOT NULL,
    "internalComment" TEXT,
    "status" "UsedEquipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "reservedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedEquipmentImage" (
    "id" TEXT NOT NULL,
    "usedEquipmentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "bytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedEquipmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedEquipmentInquiry" (
    "id" TEXT NOT NULL,
    "usedEquipmentId" TEXT NOT NULL,
    "equipmentTitle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT,
    "status" "UsedEquipmentInquiryStatus" NOT NULL DEFAULT 'NEW',
    "assignedManagerId" TEXT,
    "internalComment" TEXT,
    "source" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedEquipmentInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsedEquipment_slug_key" ON "UsedEquipment"("slug");

-- CreateIndex
CREATE INDEX "UsedEquipment_status_idx" ON "UsedEquipment"("status");

-- CreateIndex
CREATE INDEX "UsedEquipment_manufacturerId_idx" ON "UsedEquipment"("manufacturerId");

-- CreateIndex
CREATE INDEX "UsedEquipment_createdAt_idx" ON "UsedEquipment"("createdAt");

-- CreateIndex
CREATE INDEX "UsedEquipment_publishedAt_idx" ON "UsedEquipment"("publishedAt");

-- CreateIndex
CREATE INDEX "UsedEquipment_status_publishedAt_idx" ON "UsedEquipment"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "UsedEquipmentImage_usedEquipmentId_idx" ON "UsedEquipmentImage"("usedEquipmentId");

-- CreateIndex
CREATE INDEX "UsedEquipmentImage_usedEquipmentId_sortOrder_idx" ON "UsedEquipmentImage"("usedEquipmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "UsedEquipmentImage_usedEquipmentId_isPrimary_idx" ON "UsedEquipmentImage"("usedEquipmentId", "isPrimary");

-- CreateIndex
CREATE INDEX "UsedEquipmentInquiry_usedEquipmentId_idx" ON "UsedEquipmentInquiry"("usedEquipmentId");

-- CreateIndex
CREATE INDEX "UsedEquipmentInquiry_status_idx" ON "UsedEquipmentInquiry"("status");

-- CreateIndex
CREATE INDEX "UsedEquipmentInquiry_assignedManagerId_idx" ON "UsedEquipmentInquiry"("assignedManagerId");

-- CreateIndex
CREATE INDEX "UsedEquipmentInquiry_createdAt_idx" ON "UsedEquipmentInquiry"("createdAt");

-- CreateIndex
CREATE INDEX "UsedEquipmentInquiry_status_createdAt_idx" ON "UsedEquipmentInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UsedEquipmentInquiry_normalizedPhone_idx" ON "UsedEquipmentInquiry"("normalizedPhone");

-- AddForeignKey
ALTER TABLE "UsedEquipment" ADD CONSTRAINT "UsedEquipment_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedEquipment" ADD CONSTRAINT "UsedEquipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedEquipment" ADD CONSTRAINT "UsedEquipment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedEquipmentImage" ADD CONSTRAINT "UsedEquipmentImage_usedEquipmentId_fkey" FOREIGN KEY ("usedEquipmentId") REFERENCES "UsedEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedEquipmentInquiry" ADD CONSTRAINT "UsedEquipmentInquiry_usedEquipmentId_fkey" FOREIGN KEY ("usedEquipmentId") REFERENCES "UsedEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedEquipmentInquiry" ADD CONSTRAINT "UsedEquipmentInquiry_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
