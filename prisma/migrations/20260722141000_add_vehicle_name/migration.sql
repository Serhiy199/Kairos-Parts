ALTER TABLE "Vehicle" ADD COLUMN "name" TEXT;

UPDATE "Vehicle"
SET "name" = LEFT(
  COALESCE(
    NULLIF(CONCAT_WS(' ', NULLIF(BTRIM("manufacturer"), ''), NULLIF(BTRIM("model"), '')), ''),
    NULLIF(BTRIM("model"), ''),
    NULLIF(BTRIM("manufacturer"), ''),
    NULLIF(BTRIM("type"), ''),
    'Техніка'
  ),
  120
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Vehicle"
    WHERE "name" IS NULL OR CHAR_LENGTH(BTRIM("name")) < 2 OR CHAR_LENGTH("name") > 120
  ) THEN
    RAISE EXCEPTION 'Vehicle.name backfill produced an invalid value';
  END IF;
END $$;

ALTER TABLE "Vehicle" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_name_length_check"
  CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 2 AND 120);
