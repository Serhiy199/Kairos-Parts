-- Stage Client Auth 2B: canonical CLIENT phone identity for deterministic login.
ALTER TABLE "User" ADD COLUMN "normalizedPhone" TEXT;

WITH normalized_clients AS (
  SELECT
    "id",
    regexp_replace(btrim("phone"), '[ ()-]', '', 'g') AS compact
  FROM "User"
  WHERE "role" = 'CLIENT'
)
UPDATE "User" AS target
SET "normalizedPhone" = CASE
  WHEN source.compact ~ '^0[0-9]{9}$' THEN '+38' || source.compact
  WHEN source.compact ~ '^380[0-9]{9}$' THEN '+' || source.compact
  WHEN source.compact ~ '^[+]380[0-9]{9}$' THEN source.compact
  ELSE NULL
END
FROM normalized_clients AS source
WHERE target."id" = source."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "role" = 'CLIENT' AND "normalizedPhone" IS NULL
  ) THEN
    RAISE EXCEPTION 'normalizedPhone backfill blocked: CLIENT without a valid canonical phone';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "normalizedPhone" IS NOT NULL
      AND ("role" <> 'CLIENT' OR "normalizedPhone" !~ '^[+]380[0-9]{9}$')
  ) THEN
    RAISE EXCEPTION 'normalizedPhone backfill blocked: invalid role or canonical format';
  END IF;

  IF EXISTS (
    SELECT "normalizedPhone"
    FROM "User"
    WHERE "normalizedPhone" IS NOT NULL
    GROUP BY "normalizedPhone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'normalizedPhone backfill blocked: duplicate canonical phone';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_normalizedPhone_key" ON "User"("normalizedPhone");

ALTER TABLE "User"
ADD CONSTRAINT "User_normalizedPhone_client_format_check"
CHECK (
  "normalizedPhone" IS NULL
  OR ("role" = 'CLIENT' AND "normalizedPhone" ~ '^[+]380[0-9]{9}$')
);
