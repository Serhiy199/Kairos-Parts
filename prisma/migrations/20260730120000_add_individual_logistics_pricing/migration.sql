CREATE TYPE "LogisticsPricingType" AS ENUM ('FIXED', 'INDIVIDUAL');

ALTER TABLE "LogisticsRequest"
ADD COLUMN "pricingType" "LogisticsPricingType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "customLocality" TEXT,
ALTER COLUMN "tariffCityId" DROP NOT NULL,
ALTER COLUMN "tariffCityCodeSnapshot" DROP NOT NULL,
ALTER COLUMN "tariffCityNameSnapshot" DROP NOT NULL,
ALTER COLUMN "baseTariffSnapshot" DROP NOT NULL,
ALTER COLUMN "additionalPointsCharge" DROP NOT NULL,
ALTER COLUMN "farmDeliveryCharge" DROP NOT NULL,
ALTER COLUMN "totalPrice" DROP NOT NULL;

ALTER TABLE "LogisticsRequest"
DROP CONSTRAINT "LogisticsRequest_amounts_non_negative_check";

ALTER TABLE "LogisticsRequest"
ADD CONSTRAINT "LogisticsRequest_pricing_contract_check"
CHECK (
  (
    "pricingType"::text = 'FIXED'
    AND "tariffCityId" IS NOT NULL
    AND "tariffCityCodeSnapshot" IS NOT NULL
    AND CHAR_LENGTH(BTRIM("tariffCityCodeSnapshot")) > 0
    AND "tariffCityNameSnapshot" IS NOT NULL
    AND CHAR_LENGTH(BTRIM("tariffCityNameSnapshot")) > 0
    AND "customLocality" IS NULL
    AND "baseTariffSnapshot" IS NOT NULL
    AND "baseTariffSnapshot" >= 0
    AND "additionalPointsCharge" IS NOT NULL
    AND "additionalPointsCharge" >= 0
    AND "farmDeliveryCharge" IS NOT NULL
    AND "farmDeliveryCharge" >= 0
    AND "totalPrice" IS NOT NULL
    AND "totalPrice" >= 0
  )
  OR
  (
    "pricingType"::text = 'INDIVIDUAL'
    AND "tariffCityId" IS NULL
    AND "tariffCityCodeSnapshot" IS NULL
    AND "tariffCityNameSnapshot" IS NULL
    AND "customLocality" IS NOT NULL
    AND CHAR_LENGTH(BTRIM("customLocality")) > 0
    AND "baseTariffSnapshot" IS NULL
    AND "additionalPointsCharge" IS NULL
    AND "farmDeliveryCharge" IS NULL
    AND ("totalPrice" IS NULL OR "totalPrice" > 0)
  )
);

ALTER TYPE "AuditAction"
ADD VALUE IF NOT EXISTS 'LOGISTICS_INDIVIDUAL_PRICE_CHANGED';
