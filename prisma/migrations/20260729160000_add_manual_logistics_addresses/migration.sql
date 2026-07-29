ALTER TYPE "LogisticsAddressProvider" ADD VALUE IF NOT EXISTS 'MANUAL';

ALTER TABLE "LogisticsPickupPoint"
ADD COLUMN "supplierName" TEXT,
ALTER COLUMN "normalizedLocality" DROP NOT NULL;

ALTER TABLE "LogisticsRequest"
DROP CONSTRAINT "LogisticsRequest_destination_consistency_check";

ALTER TABLE "LogisticsRequest"
ADD CONSTRAINT "LogisticsRequest_destination_consistency_check"
CHECK (
    (
        "destinationType" = 'KAIROS_BASE'
        AND "baseAddressSnapshot" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("baseAddressSnapshot")) > 0
        AND "farmFormattedAddress" IS NULL
        AND "farmExternalAddressId" IS NULL
        AND "farmAddressProvider" IS NULL
        AND "farmNormalizedLocality" IS NULL
    )
    OR
    (
        "destinationType" = 'FARM'
        AND "baseAddressSnapshot" IS NULL
        AND "farmFormattedAddress" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("farmFormattedAddress")) > 0
        AND "farmAddressProvider"::text = 'MANUAL'
        AND "farmExternalAddressId" IS NULL
        AND "farmNormalizedLocality" IS NULL
    )
    OR
    (
        "destinationType" = 'FARM'
        AND "baseAddressSnapshot" IS NULL
        AND "farmFormattedAddress" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("farmFormattedAddress")) > 0
        AND "farmAddressProvider"::text IN ('MOCK', 'GOOGLE')
        AND "farmNormalizedLocality" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("farmNormalizedLocality")) > 0
    )
);

ALTER TABLE "LogisticsPickupPoint"
ADD CONSTRAINT "LogisticsPickupPoint_manual_address_consistency_check"
CHECK (
    (
        "addressProvider"::text = 'MANUAL'
        AND "supplierName" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("supplierName")) > 0
        AND CHAR_LENGTH(BTRIM("formattedAddress")) > 0
        AND "externalAddressId" IS NULL
        AND "normalizedLocality" IS NULL
        AND "normalizedAdministrativeArea" IS NULL
    )
    OR
    (
        "addressProvider"::text IN ('MOCK', 'GOOGLE')
        AND CHAR_LENGTH(BTRIM("formattedAddress")) > 0
        AND "normalizedLocality" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("normalizedLocality")) > 0
    )
);
