import {
  buildRateLimitKeyHashes,
  hmacRateLimitKey,
  type RateLimitKeyHashes
} from '@/lib/auth/rate-limit-core';

export const AUTH_RATE_LIMIT_TEST_SECRET = 'stage-2c-test-only-hmac-secret-not-for-deployment-0001';

export function rateLimitTestKeys(identifierLabel: string, ipLabel = identifierLabel): RateLimitKeyHashes {
  return {
    identifierHash: hmacRateLimitKey(
      AUTH_RATE_LIMIT_TEST_SECRET,
      'identifier',
      `unknown:stage-2c-test:${identifierLabel}`
    ),
    ipHash: hmacRateLimitKey(
      AUTH_RATE_LIMIT_TEST_SECRET,
      'ip',
      `stage-2c-test-ip:${ipLabel}`
    )
  };
}

export function allRateLimitTestHashes() {
  const browserKeys = buildRateLimitKeyHashes({
    identifier: 'stage-2c-browser@example.test',
    headers: new Headers(),
    secret: AUTH_RATE_LIMIT_TEST_SECRET,
    policy: { isVercel: false, trustProxy: false }
  });
  const keys = [
    browserKeys,
    rateLimitTestKeys('threshold'),
    rateLimitTestKeys('expiry'),
    rateLimitTestKeys('concurrency'),
    rateLimitTestKeys('dual-empty'),
    ...Array.from({ length: 20 }, (_, index) => rateLimitTestKeys(`ip-identifier-${index}`, 'shared-ip'))
  ];

  return [...new Set(keys.flatMap((key) => [key.identifierHash, key.ipHash]))];
}
