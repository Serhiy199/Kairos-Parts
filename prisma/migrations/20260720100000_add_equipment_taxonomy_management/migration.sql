-- Extend the existing manufacturer directory without changing historical category relations.
ALTER TABLE "Manufacturer"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManufacturerEquipmentType" (
    "manufacturerId" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManufacturerEquipmentType_pkey" PRIMARY KEY ("manufacturerId", "equipmentTypeId")
);

CREATE UNIQUE INDEX "EquipmentType_normalizedName_key" ON "EquipmentType"("normalizedName");
CREATE UNIQUE INDEX "EquipmentType_slug_key" ON "EquipmentType"("slug");
CREATE INDEX "EquipmentType_isActive_sortOrder_idx" ON "EquipmentType"("isActive", "sortOrder");
CREATE INDEX "Manufacturer_isActive_sortOrder_idx" ON "Manufacturer"("isActive", "sortOrder");
CREATE INDEX "ManufacturerEquipmentType_equipmentTypeId_idx" ON "ManufacturerEquipmentType"("equipmentTypeId");

ALTER TABLE "ManufacturerEquipmentType"
ADD CONSTRAINT "ManufacturerEquipmentType_manufacturerId_fkey"
FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManufacturerEquipmentType"
ADD CONSTRAINT "ManufacturerEquipmentType_equipmentTypeId_fkey"
FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AuditEntityType" ADD VALUE 'EQUIPMENT_TYPE';
ALTER TYPE "AuditEntityType" ADD VALUE 'MANUFACTURER';
