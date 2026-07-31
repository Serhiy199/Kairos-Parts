ALTER TYPE "AuditAction"
ADD VALUE IF NOT EXISTS 'LOGISTICS_PREFERRED_DATE_CHANGED';

ALTER TABLE "LogisticsRequest"
ADD COLUMN "preferredDeliveryDate" DATE,
ADD COLUMN "preferredDeliveryDateSnapshot" DATE;
