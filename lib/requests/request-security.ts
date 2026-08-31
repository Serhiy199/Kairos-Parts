import 'server-only';

import { randomInt, randomUUID } from 'node:crypto';

import {
  currentTrustedIpPolicy,
  extractTrustedClientIp,
  hmacRateLimitKey,
  requireRateLimitSecret
} from '@/lib/auth/rate-limit-core';
import { cleanupStaleRateLimitBuckets } from '@/lib/auth/rate-limit-store';
import { MAX_REQUEST_FILE_TOTAL_BYTES } from '@/lib/files/request-file-validation';
import { prisma } from '@/lib/prisma';

const WINDOW_MINUTES = 15;
const IP_MAX_REQUESTS = 10;
const PHONE_MAX_REQUESTS = 5;
const CLEANUP_SAMPLE_RATE = 64;
export const MAX_REQUEST_MULTIPART_BYTES = MAX_REQUEST_FILE_TOTAL_BYTES + 2 * 1024 * 1024;

type RateLimitRow = { blocked: boolean; retryAfterSeconds: number };

export class PublicRequestSecurityError extends Error {
  constructor(
    readonly code: 'INVALID_ORIGIN' | 'INVALID_BODY' | 'BODY_TOO_LARGE' | 'RATE_LIMITED' | 'SECURITY_UNAVAILABLE',
    readonly statusCode: 400 | 413 | 429 | 503,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'PublicRequestSecurityError';
  }
}

export async function readBoundedPublicRequestFormData(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new PublicRequestSecurityError('INVALID_BODY', 400, 'Некоректний формат даних заявки.');
  }
  if (!request.body) {
    throw new PublicRequestSecurityError('INVALID_BODY', 400, 'Дані заявки відсутні.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_MULTIPART_BYTES) {
        await reader.cancel();
        throw new PublicRequestSecurityError('BODY_TOO_LARGE', 413, 'Розмір заявки перевищує дозволений ліміт.');
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
    return await new Response(body, { headers: { 'content-type': contentType } }).formData();
  } catch (error) {
    if (error instanceof PublicRequestSecurityError) throw error;
    throw new PublicRequestSecurityError('INVALID_BODY', 400, 'Не вдалося прочитати дані форми.');
  } finally {
    reader.releaseLock();
  }
}

function expectedOrigins(request: Request) {
  const origins = new Set<string>();
  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // The runtime normally guarantees a valid request URL.
  }
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',', 1)[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',', 1)[0]?.trim() || 'https';
  if (forwardedHost && (forwardedProto === 'http' || forwardedProto === 'https')) {
    origins.add(`${forwardedProto}://${forwardedHost}`);
  }
  for (const configured of [process.env.APP_BASE_URL, process.env.NEXTAUTH_URL]) {
    if (!configured) continue;
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Invalid optional configuration cannot authorize an origin.
    }
  }
  return origins;
}

export function assertPublicRequestOrigin(request: Request) {
  const origin = request.headers.get('origin');
  let normalizedOrigin: string;
  try {
    if (!origin) throw new Error('missing');
    normalizedOrigin = new URL(origin).origin;
  } catch {
    throw new PublicRequestSecurityError('INVALID_ORIGIN', 400, 'Не вдалося підтвердити джерело запиту.');
  }
  if (!expectedOrigins(request).has(normalizedOrigin)) {
    throw new PublicRequestSecurityError('INVALID_ORIGIN', 400, 'Не вдалося підтвердити джерело запиту.');
  }
}

export function assertPublicRequestBodyLength(request: Request) {
  const raw = request.headers.get('content-length');
  if (!raw) return;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_REQUEST_MULTIPART_BYTES) {
    throw new PublicRequestSecurityError('BODY_TOO_LARGE', 413, 'Розмір заявки перевищує дозволений ліміт.');
  }
}

async function consumePersistentBucket(
  scope: 'IDENTIFIER' | 'IP',
  keyHash: string,
  limit: number
) {
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "AuthRateLimitBucket" AS bucket (
      "id", "scope", "keyHash", "windowStart", "attemptCount", "blockedUntil", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${scope}::"AuthRateLimitScope", ${keyHash}, CURRENT_TIMESTAMP, 1, NULL,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("scope", "keyHash") DO UPDATE SET
      "windowStart" = CASE
        WHEN bucket."windowStart" <= CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute')
          THEN CURRENT_TIMESTAMP ELSE bucket."windowStart" END,
      "attemptCount" = CASE
        WHEN bucket."windowStart" <= CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute')
          THEN 1 ELSE bucket."attemptCount" + 1 END,
      "blockedUntil" = CASE
        WHEN bucket."windowStart" <= CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN NULL
        WHEN bucket."blockedUntil" IS NOT NULL AND bucket."blockedUntil" > CURRENT_TIMESTAMP
          THEN bucket."blockedUntil"
        WHEN bucket."attemptCount" + 1 > ${limit}
          THEN CURRENT_TIMESTAMP + (${WINDOW_MINUTES} * INTERVAL '1 minute')
        ELSE NULL END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING
      ("blockedUntil" IS NOT NULL AND "blockedUntil" > CURRENT_TIMESTAMP) AS "blocked",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE("blockedUntil", CURRENT_TIMESTAMP) - CURRENT_TIMESTAMP))))::int AS "retryAfterSeconds"
  `;
  const decision = rows[0];
  if (decision?.blocked) {
    throw new PublicRequestSecurityError(
      'RATE_LIMITED',
      429,
      'Забагато спроб. Спробуйте надіслати заявку пізніше.',
      decision.retryAfterSeconds
    );
  }
}

async function maybeCleanup() {
  if (randomInt(CLEANUP_SAMPLE_RATE) !== 0) return;
  await cleanupStaleRateLimitBuckets();
}

export async function consumeGuestRequestIpLimit(request: Request) {
  try {
    const secret = requireRateLimitSecret();
    const ip = extractTrustedClientIp(request.headers, currentTrustedIpPolicy());
    const hash = hmacRateLimitKey(secret, 'ip', `parts-request:${ip}`);
    await consumePersistentBucket('IP', hash, IP_MAX_REQUESTS);
    await maybeCleanup();
  } catch (error) {
    if (error instanceof PublicRequestSecurityError) throw error;
    console.error('Guest request rate-limit operation failed.', {
      stage: 'ip',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
    throw new PublicRequestSecurityError('SECURITY_UNAVAILABLE', 503, 'Не вдалося безпечно обробити заявку. Спробуйте пізніше.');
  }
}

export async function consumeGuestRequestPhoneLimit(normalizedPhone: string) {
  try {
    const secret = requireRateLimitSecret();
    const hash = hmacRateLimitKey(secret, 'identifier', `parts-request:phone:${normalizedPhone}`);
    await consumePersistentBucket('IDENTIFIER', hash, PHONE_MAX_REQUESTS);
  } catch (error) {
    if (error instanceof PublicRequestSecurityError) throw error;
    console.error('Guest request rate-limit operation failed.', {
      stage: 'phone',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });
    throw new PublicRequestSecurityError('SECURITY_UNAVAILABLE', 503, 'Не вдалося безпечно обробити заявку. Спробуйте пізніше.');
  }
}
