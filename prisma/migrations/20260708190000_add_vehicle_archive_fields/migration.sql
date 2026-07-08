-- Add soft archive metadata for vehicles. This does not delete vehicles or related history.
ALTER TABLE "Vehicle" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "archivedById" TEXT;

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Vehicle_archivedAt_idx" ON "Vehicle"("archivedAt");
CREATE INDEX "Vehicle_archivedById_idx" ON "Vehicle"("archivedById");
