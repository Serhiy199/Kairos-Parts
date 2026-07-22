-- Extend AuditLog without replacing the table or modifying existing identifiers/timestamps.
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'INVOICE';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TEAM_MEMBER';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CLIENT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'AUTH_SESSION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TELEGRAM_REQUEST';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'SYSTEM';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANAGER_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANAGER_ENABLED';

CREATE TYPE "AuditLogCategory" AS ENUM (
  'TECHNICAL',
  'LOGIN',
  'CRITICAL_READ',
  'STANDARD',
  'FINANCIAL_CRITICAL'
);

ALTER TABLE "AuditLog"
  ADD COLUMN "actorName" TEXT,
  ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "actorRole" "UserRole",
  ADD COLUMN "entityLabel" TEXT,
  ADD COLUMN "category" "AuditLogCategory",
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Snapshot current relation-backed actors. Missing/deleted actors intentionally remain null.
UPDATE "AuditLog" AS audit
SET
  "actorName" = actor."name",
  "actorEmail" = actor."email",
  "actorRole" = actor."role"
FROM "User" AS actor
WHERE audit."actorId" = actor."id";

-- Historical events have no reliable finer-grained classification.
UPDATE "AuditLog"
SET
  "category" = 'STANDARD',
  "expiresAt" = "createdAt" + INTERVAL '45 days';

ALTER TABLE "AuditLog"
  ALTER COLUMN "category" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET NOT NULL;

DROP INDEX "AuditLog_actorId_idx";
DROP INDEX "AuditLog_entityType_entityId_idx";

CREATE INDEX "AuditLog_expiresAt_idx" ON "AuditLog"("expiresAt");
CREATE INDEX "AuditLog_category_createdAt_idx" ON "AuditLog"("category", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
