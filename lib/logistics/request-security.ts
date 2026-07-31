import 'server-only';

import {
  currentTrustedIpPolicy,
  extractTrustedClientIp,
  hmacRateLimitKey,
  requireRateLimitSecret
} from '@/lib/auth/rate-limit-core';
import type { LogisticsSubmitIdentity } from '@/lib/logistics/access';
import { LogisticsRequestError } from '@/lib/logistics/request-errors';

type RuntimeBucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const QUOTE_MAX_REQUESTS = 60;
const CREATE_MAX_REQUESTS = 10;
const runtimeBuckets = new Map<string, RuntimeBucket>();

function expectedRequestOrigins(request: Request) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // The request URL is validated by the runtime; keep the set empty on failure.
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',', 1)[0]?.trim();
  const forwardedProto =
    request.headers.get('x-forwarded-proto')?.split(',', 1)[0]?.trim() || 'https';
  if (
    forwardedHost &&
    (forwardedProto === 'http' || forwardedProto === 'https')
  ) {
    origins.add(`${forwardedProto}://${forwardedHost}`);
  }

  for (const configured of [process.env.APP_BASE_URL, process.env.NEXTAUTH_URL]) {
    if (!configured) continue;
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Ignore invalid optional configuration.
    }
  }

  return origins;
}
export function assertLogisticsSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    throw new LogisticsRequestError(
      'INVALID_REQUEST',
      400,
      'Не вдалося підтвердити джерело запиту.'
    );
  }

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    throw new LogisticsRequestError(
      'INVALID_REQUEST',
      400,
      'Не вдалося підтвердити джерело запиту.'
    );
  }

  if (!expectedRequestOrigins(request).has(normalizedOrigin)) {
    throw new LogisticsRequestError(
      'INVALID_REQUEST',
      400,
      'Не вдалося підтвердити джерело запиту.'
    );
  }
}

function consumeRuntimeBucket(key: string, limit: number) {
  const now = Date.now();
  const current = runtimeBuckets.get(key);
  if (!current || current.resetAt <= now) {
    runtimeBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (current.count >= limit) {
    throw new LogisticsRequestError(
      'RATE_LIMITED',
      429,
      'Забагато запитів. Спробуйте пізніше.',
      undefined,
      Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    );
  }

  current.count += 1;
}

function hashedIp(request: Request, secret: string) {
  const ip = extractTrustedClientIp(
    request.headers,
    currentTrustedIpPolicy()
  );
  return hmacRateLimitKey(secret, 'ip', ip);
}

export function consumeLogisticsQuoteRuntimeLimit(request: Request) {
  const secret = requireRateLimitSecret();
  consumeRuntimeBucket(`logistics:quote:ip:${hashedIp(request, secret)}`, QUOTE_MAX_REQUESTS);
}

export function consumeLogisticsCreateRuntimeLimit(input: {
  request: Request;
  normalizedPhone: string;
  identity: LogisticsSubmitIdentity;
}) {
  const secret = requireRateLimitSecret();
  const ipKey = hashedIp(input.request, secret);
  const identityValue =
    input.identity.type === 'CLIENT'
      ? `user:${input.identity.userId}`
      : `phone:${input.normalizedPhone}`;
  const identityKey = hmacRateLimitKey(secret, 'identifier', identityValue);

  consumeRuntimeBucket(`logistics:create:ip:${ipKey}`, CREATE_MAX_REQUESTS);
  consumeRuntimeBucket(
    `logistics:create:identity:${identityKey}`,
    CREATE_MAX_REQUESTS
  );
}

export function resetLogisticsRuntimeRateLimitsForChecks() {
  runtimeBuckets.clear();
}
