-- Manual request entry must preserve the submitted manufacturer without
-- creating or guessing a taxonomy relation. Existing relations are copied to
-- the snapshot so historical requests keep the same display value.
ALTER TABLE "Request" ADD COLUMN "manufacturerName" TEXT;

UPDATE "Request" AS request
SET "manufacturerName" = manufacturer."name"
FROM "Manufacturer" AS manufacturer
WHERE request."manufacturerId" = manufacturer."id"
  AND request."manufacturerName" IS NULL;
