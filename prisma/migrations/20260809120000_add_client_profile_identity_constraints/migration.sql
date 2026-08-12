-- Stage Client Profile Editing 1: reject case-insensitive auth email collisions
-- before adding the expression index. Existing values are never rewritten.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT lower("email")
    FROM "User"
    WHERE "email" IS NOT NULL
    GROUP BY lower("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'case-insensitive User email collision blocks profile identity migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_email_lower_key"
ON "User" (lower("email"))
WHERE "email" IS NOT NULL;

ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_IDENTITY_UPDATED';

COMMIT;
