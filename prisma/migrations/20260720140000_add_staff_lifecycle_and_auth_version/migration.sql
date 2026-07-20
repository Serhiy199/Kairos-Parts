-- Stage Admin Users 2A: add a shared lifecycle and JWT revocation counter.
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- The non-null defaults safely backfill all existing users without changing roles or passwords.
ALTER TABLE "User"
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
