ALTER TABLE "RequestItem"
ADD COLUMN "equipmentType" TEXT;

UPDATE "RequestItem" AS item
SET "equipmentType" = request."equipmentType"
FROM "Request" AS request
WHERE item."requestId" = request."id"
  AND item."equipmentType" IS NULL
  AND request."equipmentType" IS NOT NULL;
