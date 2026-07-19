-- CreateTable
CREATE TABLE "VehicleImage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "format" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleImage_vehicleId_idx" ON "VehicleImage"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleImage_vehicleId_sortOrder_idx" ON "VehicleImage"("vehicleId", "sortOrder");

-- CreateIndex
CREATE INDEX "VehicleImage_vehicleId_isPrimary_idx" ON "VehicleImage"("vehicleId", "isPrimary");

-- AddForeignKey
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
