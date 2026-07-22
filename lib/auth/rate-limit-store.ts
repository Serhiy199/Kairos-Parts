import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import {
  IDENTIFIER_MAX_ATTEMPTS,
  IP_MAX_ATTEMPTS,
  RATE_LIMIT_CLEANUP_BATCH_SIZE,
  RATE_LIMIT_RETENTION_HOURS,
  RATE_LIMIT_WINDOW_MINUTES,
  type RateLimitKeyHashes
} from '@/lib/auth/rate-limit-core';

export type RateLimitDecision = {
  blocked: boolean;
  identifierBlocked: boolean;
  ipBlocked: boolean;
};

type BucketRow = {
  attemptCount: number;
  blocked: boolean;
  scope: 'IDENTIFIER' | 'IP';
};

export async function checkRateLimitBuckets(keys: RateLimitKeyHashes): Promise<RateLimitDecision> {
  const rows = await prisma.$queryRaw<BucketRow[]>`
    SELECT
      "scope",
      "attemptCount",
      ("blockedUntil" IS NOT NULL AND "blockedUntil" > CURRENT_TIMESTAMP) AS "blocked"
    FROM "AuthRateLimitBucket"
    WHERE
      ("scope" = 'IDENTIFIER'::"AuthRateLimitScope" AND "keyHash" = ${keys.identifierHash})
      OR ("scope" = 'IP'::"AuthRateLimitScope" AND "keyHash" = ${keys.ipHash})
  `;

  return decisionFromRows(rows);
}

export async function recordRateLimitFailure(keys: RateLimitKeyHashes): Promise<RateLimitDecision> {
  const rows = await prisma.$queryRaw<BucketRow[]>`
    INSERT INTO "AuthRateLimitBucket" AS bucket (
      "id", "scope", "keyHash", "windowStart", "attemptCount", "blockedUntil", "createdAt", "updatedAt"
    )
    VALUES
      (
        ${randomUUID()},
        'IDENTIFIER'::"AuthRateLimitScope",
        ${keys.identifierHash},
        CURRENT_TIMESTAMP,
        1,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        ${randomUUID()},
        'IP'::"AuthRateLimitScope",
        ${keys.ipHash},
        CURRENT_TIMESTAMP,
        1,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    ON CONFLICT ("scope", "keyHash") DO UPDATE SET
      "windowStart" = CASE
        WHEN bucket."windowStart" <= CURRENT_TIMESTAMP - (${RATE_LIMIT_WINDOW_MINUTES} * INTERVAL '1 minute')
          THEN CURRENT_TIMESTAMP
        ELSE bucket."windowStart"
      END,
      "attemptCount" = CASE
        WHEN bucket."windowStart" <= CURRENT_TIMESTAMP - (${RATE_LIMIT_WINDOW_MINUTES} * INTERVAL '1 minute')
          THEN 1
        ELSE bucket."attemptCount" + 1
      END,
      "blockedUntil" = CASE
        WHEN bucket."windowStart" <= CURRENT_TIMESTAMP - (${RATE_LIMIT_WINDOW_MINUTES} * INTERVAL '1 minute')
          THEN NULL
        WHEN bucket."attemptCount" + 1 >= CASE bucket."scope"
          WHEN 'IDENTIFIER'::"AuthRateLimitScope" THEN ${IDENTIFIER_MAX_ATTEMPTS}
          ELSE ${IP_MAX_ATTEMPTS}
        END
          THEN bucket."windowStart" + (${RATE_LIMIT_WINDOW_MINUTES} * INTERVAL '1 minute')
        ELSE bucket."blockedUntil"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      "scope",
      "attemptCount",
      ("blockedUntil" IS NOT NULL AND "blockedUntil" > CURRENT_TIMESTAMP) AS "blocked"
  `;

  return decisionFromRows(rows);
}

export async function clearIdentifierRateLimit(identifierHash: string) {
  await prisma.authRateLimitBucket.deleteMany({
    where: { scope: 'IDENTIFIER', keyHash: identifierHash }
  });
}

export async function cleanupStaleRateLimitBuckets() {
  return prisma.$executeRaw`
    DELETE FROM "AuthRateLimitBucket"
    WHERE "id" IN (
      SELECT "id"
      FROM "AuthRateLimitBucket"
      WHERE
        "updatedAt" < CURRENT_TIMESTAMP - (${RATE_LIMIT_RETENTION_HOURS} * INTERVAL '1 hour')
        AND "windowStart" < CURRENT_TIMESTAMP - (${RATE_LIMIT_RETENTION_HOURS} * INTERVAL '1 hour')
        AND ("blockedUntil" IS NULL OR "blockedUntil" < CURRENT_TIMESTAMP)
      ORDER BY "updatedAt" ASC
      LIMIT ${RATE_LIMIT_CLEANUP_BATCH_SIZE}
    )
  `;
}

function decisionFromRows(rows: BucketRow[]): RateLimitDecision {
  const identifierBlocked = rows.some((row) => row.scope === 'IDENTIFIER' && row.blocked);
  const ipBlocked = rows.some((row) => row.scope === 'IP' && row.blocked);

  return {
    blocked: identifierBlocked || ipBlocked,
    identifierBlocked,
    ipBlocked
  };
}
