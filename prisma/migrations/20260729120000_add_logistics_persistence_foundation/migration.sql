-- CreateEnum
CREATE TYPE "LogisticsRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogisticsDestinationType" AS ENUM ('KAIROS_BASE', 'FARM');

-- CreateEnum
CREATE TYPE "LogisticsAddressProvider" AS ENUM ('MOCK', 'GOOGLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'LOGISTICS_REQUEST';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'LOGISTICS_TARIFF_CITY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGISTICS_REQUEST_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGISTICS_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGISTICS_INTERNAL_COMMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGISTICS_TARIFF_UPDATED';

-- CreateSequence
-- PostgreSQL allocates the LG number atomically. The lpad expression keeps the
-- approved public format without application-side count()+1 generation.
CREATE SEQUENCE "logistics_request_number_seq"
AS BIGINT
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

-- CreateTable
CREATE TABLE "LogisticsTariffCity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsTariffCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL DEFAULT 'LG-'::text || lpad(nextval('logistics_request_number_seq'::regclass)::text, 6, '0'::text),
    "status" "LogisticsRequestStatus" NOT NULL DEFAULT 'NEW',
    "clientId" TEXT,
    "companyId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "tariffCityId" TEXT NOT NULL,
    "tariffCityCodeSnapshot" TEXT NOT NULL,
    "tariffCityNameSnapshot" TEXT NOT NULL,
    "baseTariffSnapshot" DECIMAL(12,2) NOT NULL,
    "destinationType" "LogisticsDestinationType" NOT NULL,
    "baseAddressSnapshot" TEXT,
    "farmFormattedAddress" TEXT,
    "farmExternalAddressId" TEXT,
    "farmAddressProvider" "LogisticsAddressProvider",
    "farmNormalizedLocality" TEXT,
    "pickupPointCount" INTEGER NOT NULL,
    "additionalPointsCharge" DECIMAL(12,2) NOT NULL,
    "farmDeliveryCharge" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "clientComment" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsRequest_pkey" PRIMARY KEY ("id")
);

ALTER SEQUENCE "logistics_request_number_seq"
OWNED BY "LogisticsRequest"."requestNumber";

-- CreateTable
CREATE TABLE "LogisticsPickupPoint" (
    "id" TEXT NOT NULL,
    "logisticsRequestId" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "externalAddressId" TEXT,
    "addressProvider" "LogisticsAddressProvider" NOT NULL,
    "normalizedLocality" TEXT NOT NULL,
    "normalizedAdministrativeArea" TEXT,
    "cargoDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsPickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsInternalComment" (
    "id" TEXT NOT NULL,
    "logisticsRequestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogisticsInternalComment_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "LogisticsTariffCity"
ADD CONSTRAINT "LogisticsTariffCity_price_non_negative_check"
CHECK ("price" >= 0);

ALTER TABLE "LogisticsRequest"
ADD CONSTRAINT "LogisticsRequest_request_number_format_check"
CHECK ("requestNumber" ~ '^LG-[0-9]{6,}$'),
ADD CONSTRAINT "LogisticsRequest_idempotency_key_not_blank_check"
CHECK (CHAR_LENGTH(BTRIM("idempotencyKey")) > 0),
ADD CONSTRAINT "LogisticsRequest_contact_phone_format_check"
CHECK ("contactPhone" ~ '^[+]380[0-9]{9}$'),
ADD CONSTRAINT "LogisticsRequest_pickup_point_count_check"
CHECK ("pickupPointCount" >= 1),
ADD CONSTRAINT "LogisticsRequest_amounts_non_negative_check"
CHECK (
    "baseTariffSnapshot" >= 0
    AND "additionalPointsCharge" >= 0
    AND "farmDeliveryCharge" >= 0
    AND "totalPrice" >= 0
),
ADD CONSTRAINT "LogisticsRequest_company_requires_client_check"
CHECK ("companyId" IS NULL OR "clientId" IS NOT NULL),
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
        AND "farmAddressProvider" IS NOT NULL
        AND "farmNormalizedLocality" IS NOT NULL
        AND CHAR_LENGTH(BTRIM("farmNormalizedLocality")) > 0
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsTariffCity_code_key" ON "LogisticsTariffCity"("code");

-- CreateIndex
CREATE INDEX "LogisticsTariffCity_isActive_idx" ON "LogisticsTariffCity"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsRequest_requestNumber_key" ON "LogisticsRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsRequest_idempotencyKey_key" ON "LogisticsRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LogisticsRequest_status_createdAt_idx" ON "LogisticsRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LogisticsRequest_clientId_createdAt_idx" ON "LogisticsRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "LogisticsRequest_companyId_createdAt_idx" ON "LogisticsRequest"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "LogisticsRequest_tariffCityId_idx" ON "LogisticsRequest"("tariffCityId");

-- CreateIndex
CREATE INDEX "LogisticsRequest_createdAt_idx" ON "LogisticsRequest"("createdAt");

-- CreateIndex
CREATE INDEX "LogisticsPickupPoint_logisticsRequestId_idx" ON "LogisticsPickupPoint"("logisticsRequestId");

-- CreateIndex
CREATE INDEX "LogisticsInternalComment_logisticsRequestId_createdAt_idx" ON "LogisticsInternalComment"("logisticsRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "LogisticsInternalComment_authorUserId_idx" ON "LogisticsInternalComment"("authorUserId");

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsRequest" ADD CONSTRAINT "LogisticsRequest_tariffCityId_fkey" FOREIGN KEY ("tariffCityId") REFERENCES "LogisticsTariffCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsPickupPoint" ADD CONSTRAINT "LogisticsPickupPoint_logisticsRequestId_fkey" FOREIGN KEY ("logisticsRequestId") REFERENCES "LogisticsRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsInternalComment" ADD CONSTRAINT "LogisticsInternalComment_logisticsRequestId_fkey" FOREIGN KEY ("logisticsRequestId") REFERENCES "LogisticsRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsInternalComment" ADD CONSTRAINT "LogisticsInternalComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InitializeTariffCities
-- These final prices already include VAT. This one-time migration insert does
-- not create a recurring seed that could overwrite future ADMIN changes.
INSERT INTO "LogisticsTariffCity"
    ("id", "code", "name", "price", "isActive", "createdAt", "updatedAt")
VALUES
    ('logistics-tariff-city-myronivka', 'MYRONIVKA', 'Миронівка', 1600.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-obukhiv', 'OBUKHIV', 'Обухів', 1700.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-uzyn', 'UZYN', 'Узин', 1800.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-vasylkiv', 'VASYLKIV', 'Васильків', 2000.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-bila-tserkva', 'BILA_TSERKVA', 'Біла Церква', 2200.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-boryspil', 'BORYSPIL', 'Бориспіль', 2400.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-kyiv-right-bank', 'KYIV_RIGHT_BANK', 'Київ — правий берег', 2500.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-kyiv-left-bank', 'KYIV_LEFT_BANK', 'Київ — лівий берег', 2600.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-brovary', 'BROVARY', 'Бровари', 2700.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-irpin', 'IRPIN', 'Ірпінь', 2900.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-bucha', 'BUCHA', 'Буча', 2900.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-berezan', 'BEREZAN', 'Березань', 3000.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('logistics-tariff-city-vyshhorod', 'VYSHHOROD', 'Вишгород', 3200.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
