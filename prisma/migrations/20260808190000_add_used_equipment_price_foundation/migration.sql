-- AlterTable
ALTER TABLE "UsedEquipment"
ADD COLUMN "priceAmount" INTEGER;

-- AddCheckConstraint
ALTER TABLE "UsedEquipment"
ADD CONSTRAINT "UsedEquipment_price_amount_check"
CHECK (
  "priceAmount" IS NULL
  OR "priceAmount" > 0
);
