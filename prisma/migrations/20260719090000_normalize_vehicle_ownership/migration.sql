-- Company-owned vehicles become company-only records before the XOR constraint
-- is installed. The pre-migration audit must confirm that every dual-owned row
-- belongs to a client who is a member of the selected company.
UPDATE "Vehicle"
SET "clientId" = NULL
WHERE "companyId" IS NOT NULL;

ALTER TABLE "Vehicle"
  ALTER COLUMN "clientId" DROP NOT NULL;

ALTER TABLE "Vehicle"
  DROP CONSTRAINT "Vehicle_clientId_fkey",
  DROP CONSTRAINT "Vehicle_companyId_fkey";

ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Vehicle_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Vehicle_exactly_one_owner_check"
    CHECK (
      ("clientId" IS NOT NULL AND "companyId" IS NULL)
      OR
      ("clientId" IS NULL AND "companyId" IS NOT NULL)
    );
