import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

export const IDENTIFIER_MAX_ATTEMPTS = 5;
export const IP_MAX_ATTEMPTS = 20;
export const RATE_LIMIT_WINDOW_MINUTES = 15;
export const RATE_LIMIT_RETENTION_HOURS = 48;
export const RATE_LIMIT_CLEANUP_BATCH_SIZE = 200;
export const RATE_LIMIT_HASH_HEX_LENGTH = 64;
export const UNKNOWN_IP = 'unknown';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_SECRET_BYTES = 32;
const MAX_UNKNOWN_IDENTIFIER_LENGTH = 512;

export type TrustedIpPolicy = {
  isVercel: boolean;
  trustProxy: boolean;
};

export type RateLimitKeyHashes = {
  identifierHash: string;
  ipHash: string;
};

export function requireRateLimitSecret(value = process.env.AUTH_RATE_LIMIT_HMAC_SECRET) {
  const secret = value?.trim() ?? '';

  if (Buffer.byteLength(secret, 'utf8') < MINIMUM_SECRET_BYTES) {
    throw new Error('AUTH_RATE_LIMIT_HMAC_SECRET must contain at least 32 bytes.');
  }

  return secret;
}

export function canonicalizeRateLimitIdentifier(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const phone = normalizeUkrainianPhone(raw);

  if (phone) {
    return `phone:${phone}`;
  }

  const email = raw.toLowerCase();
  if (EMAIL_PATTERN.test(email)) {
    return `email:${email}`;
  }

  const unknown = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_UNKNOWN_IDENTIFIER_LENGTH);

  return `unknown:${unknown || '<empty>'}`;
}

export function canonicalizeIpAddress(value: string | null | undefined) {
  const candidate = value?.trim().replace(/^\[|\]$/g, '').split('%', 1)[0] ?? '';

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
    const parts = candidate.split('.').map(Number);
    if (parts.every((part) => part >= 0 && part <= 255)) {
      return parts.join('.');
    }
  }

  if (isIP(candidate) === 4) {
    return candidate.split('.').map((part) => String(Number(part))).join('.');
  }

  if (isIP(candidate) === 6) {
    return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
  }

  return null;
}

export function extractTrustedClientIp(headers: Headers, policy: TrustedIpPolicy) {
  const candidates = policy.isVercel
    ? [
        headers.get('x-vercel-forwarded-for'),
        headers.get('x-forwarded-for'),
        headers.get('x-real-ip')
      ]
    : policy.trustProxy
      ? [headers.get('x-forwarded-for'), headers.get('x-real-ip')]
      : [];

  for (const value of candidates) {
    const firstAddress = value?.split(',', 1)[0]?.trim();
    const canonical = canonicalizeIpAddress(firstAddress);
    if (canonical) return canonical;
  }

  return UNKNOWN_IP;
}

export function hmacRateLimitKey(secret: string, namespace: 'identifier' | 'ip', canonicalValue: string) {
  return createHmac('sha256', secret)
    .update(`${namespace}:${canonicalValue}`, 'utf8')
    .digest('hex');
}

export function buildRateLimitKeyHashes(input: {
  identifier: unknown;
  headers: Headers;
  secret: string;
  policy: TrustedIpPolicy;
}): RateLimitKeyHashes {
  const canonicalIdentifier = canonicalizeRateLimitIdentifier(input.identifier);
  const canonicalIp = extractTrustedClientIp(input.headers, input.policy);

  return {
    identifierHash: hmacRateLimitKey(input.secret, 'identifier', canonicalIdentifier),
    ipHash: hmacRateLimitKey(input.secret, 'ip', canonicalIp)
  };
}

export function currentTrustedIpPolicy(env: NodeJS.ProcessEnv = process.env): TrustedIpPolicy {
  return {
    isVercel: env.VERCEL === '1',
    trustProxy: env.AUTH_RATE_LIMIT_TRUST_PROXY === 'true'
  };
}
