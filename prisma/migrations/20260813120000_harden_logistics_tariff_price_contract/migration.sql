-- Tighten the existing tariff price contract without changing stored values.
BEGIN;

ALTER TABLE "LogisticsTariffCity"
DROP CONSTRAINT "LogisticsTariffCity_price_non_negative_check";

ALTER TABLE "LogisticsTariffCity"
ADD CONSTRAINT "LogisticsTariffCity_price_positive_whole_uah_check"
CHECK ("price" > 0 AND "price" = trunc("price"));

COMMIT;
