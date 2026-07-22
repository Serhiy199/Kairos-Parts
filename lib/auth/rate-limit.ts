import 'server-only';

import { randomInt } from 'node:crypto';

import {
  buildRateLimitKeyHashes,
  currentTrustedIpPolicy,
  requireRateLimitSecret,
  type RateLimitKeyHashes
} from '@/lib/auth/rate-limit-core';
import {
  checkRateLimitBuckets,
  cleanupStaleRateLimitBuckets,
  clearIdentifierRateLimit,
  recordRateLimitFailure,
  type RateLimitDecision
} from '@/lib/auth/rate-limit-store';

const CLEANUP_SAMPLE_RATE = 64;

export async function prepareCredentialsRateLimit(input: {
  identifier: unknown;
  request: Request;
}) {
  const secret = requireRateLimitSecret();
  const keys = buildRateLimitKeyHashes({
    identifier: input.identifier,
    headers: input.request.headers,
    secret,
    policy: currentTrustedIpPolicy()
  });
  const decision = await checkRateLimitBuckets(keys);

  return { decision, keys };
}

export function recordCredentialsFailure(keys: RateLimitKeyHashes) {
  return recordRateLimitFailure(keys);
}

export function resetSuccessfulIdentifier(keys: RateLimitKeyHashes) {
  return clearIdentifierRateLimit(keys.identifierHash);
}

export async function maybeCleanupExpiredRateLimits() {
  if (randomInt(CLEANUP_SAMPLE_RATE) !== 0) return;

  try {
    await cleanupStaleRateLimitBuckets();
  } catch (error) {
    logRateLimitDatabaseError('cleanup', error);
  }
}

export function logRateLimitDatabaseError(stage: string, error: unknown) {
  console.error('Credentials rate-limit operation failed.', {
    category: 'auth_rate_limit_db_error',
    stage,
    errorType: error instanceof Error ? error.name : 'UnknownError'
  });
}

export type { RateLimitDecision };
