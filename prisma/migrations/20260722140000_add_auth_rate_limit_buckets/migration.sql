-- Stage Client Auth 2C: persistent, PII-safe credentials rate-limit buckets.
CREATE TYPE "AuthRateLimitScope" AS ENUM ('IDENTIFIER', 'IP');

CREATE TABLE "AuthRateLimitBucket" (
  "id" TEXT NOT NULL,
  "scope" "AuthRateLimitScope" NOT NULL,
  "keyHash" CHAR(64) NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthRateLimitBucket_key_hash_check" CHECK ("keyHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AuthRateLimitBucket_attempt_count_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "AuthRateLimitBucket_blocked_until_check" CHECK (
    "blockedUntil" IS NULL OR "blockedUntil" >= "windowStart"
  )
);

CREATE UNIQUE INDEX "AuthRateLimitBucket_scope_keyHash_key"
ON "AuthRateLimitBucket"("scope", "keyHash");

CREATE INDEX "AuthRateLimitBucket_blockedUntil_idx"
ON "AuthRateLimitBucket"("blockedUntil");

CREATE INDEX "AuthRateLimitBucket_updatedAt_idx"
ON "AuthRateLimitBucket"("updatedAt");
