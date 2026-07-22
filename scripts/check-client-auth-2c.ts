import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

import {
  buildRateLimitKeyHashes,
  canonicalizeIpAddress,
  canonicalizeRateLimitIdentifier,
  extractTrustedClientIp,
  hmacRateLimitKey,
  IDENTIFIER_MAX_ATTEMPTS,
  IP_MAX_ATTEMPTS,
  RATE_LIMIT_HASH_HEX_LENGTH,
  requireRateLimitSecret
} from '@/lib/auth/rate-limit-core';
import {
  checkRateLimitBuckets,
  clearIdentifierRateLimit,
  recordRateLimitFailure
} from '@/lib/auth/rate-limit-store';
import { prisma } from '@/lib/prisma';
import {
  allRateLimitTestHashes,
  AUTH_RATE_LIMIT_TEST_SECRET,
  rateLimitTestKeys
} from './auth-rate-limit-test-fixtures';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

async function main() {
  checkPureHelpers();
  checkSourceContracts();

  const testHashes = allRateLimitTestHashes();
  await deleteTestBuckets(testHashes);

  try {
    await checkIdentifierThreshold();
    await checkWindowExpiry();
    await checkConcurrentIncrements();
    await checkIpThresholdAndDualPolicy();
  } finally {
    await deleteTestBuckets(testHashes);
  }

  const leftovers = await prisma.authRateLimitBucket.count({ where: { keyHash: { in: testHashes } } });
  assert.equal(leftovers, 0);
  console.log('clientAuth2C=PASS concurrency=PASS testBucketsLeft=0');
}

function checkPureHelpers() {
  assert.equal(canonicalizeRateLimitIdentifier(' User@Email.com '), 'email:user@email.com');
  const phoneValues = ['0955305553', '380955305553', '+380955305553', '+38 (095) 530-55-53'];
  assert.equal(new Set(phoneValues.map(canonicalizeRateLimitIdentifier)).size, 1);
  assert.equal(canonicalizeRateLimitIdentifier(' Invalid   Value '), 'unknown:invalid value');

  assert.equal(canonicalizeIpAddress('192.168.001.010'), '192.168.1.10');
  assert.equal(canonicalizeIpAddress('2001:0DB8:0:0:0:0:0:1'), '2001:db8::1');
  assert.equal(canonicalizeIpAddress('not-an-ip'), null);

  const vercelHeaders = new Headers({
    'x-vercel-forwarded-for': '203.0.113.10',
    'x-forwarded-for': '198.51.100.20'
  });
  assert.equal(extractTrustedClientIp(vercelHeaders, { isVercel: true, trustProxy: false }), '203.0.113.10');
  assert.equal(extractTrustedClientIp(vercelHeaders, { isVercel: false, trustProxy: false }), 'unknown');
  assert.equal(extractTrustedClientIp(vercelHeaders, { isVercel: false, trustProxy: true }), '198.51.100.20');

  const firstHash = hmacRateLimitKey(AUTH_RATE_LIMIT_TEST_SECRET, 'identifier', 'email:user@example.test');
  const repeatedHash = hmacRateLimitKey(AUTH_RATE_LIMIT_TEST_SECRET, 'identifier', 'email:user@example.test');
  const otherSecretHash = hmacRateLimitKey('different-test-only-secret-with-at-least-32-bytes', 'identifier', 'email:user@example.test');
  const ipHash = hmacRateLimitKey(AUTH_RATE_LIMIT_TEST_SECRET, 'ip', 'email:user@example.test');
  assert.equal(firstHash, repeatedHash);
  assert.notEqual(firstHash, otherSecretHash);
  assert.notEqual(firstHash, ipHash);
  assert.equal(firstHash.length, RATE_LIMIT_HASH_HEX_LENGTH);
  assert.doesNotMatch(firstHash, /user|example/);
  assert.throws(() => requireRateLimitSecret('short'));

  const hashes = buildRateLimitKeyHashes({
    identifier: 'USER@EXAMPLE.TEST',
    headers: new Headers(),
    secret: AUTH_RATE_LIMIT_TEST_SECRET,
    policy: { isVercel: false, trustProxy: false }
  });
  assert.equal(hashes.ipHash, hmacRateLimitKey(AUTH_RATE_LIMIT_TEST_SECRET, 'ip', 'unknown'));
}

async function checkIdentifierThreshold() {
  const keys = rateLimitTestKeys('threshold');

  for (let attempt = 1; attempt <= IDENTIFIER_MAX_ATTEMPTS; attempt += 1) {
    const before = await checkRateLimitBuckets(keys);
    assert.equal(before.blocked, false);
    const after = await recordRateLimitFailure(keys);
    assert.equal(after.identifierBlocked, attempt === IDENTIFIER_MAX_ATTEMPTS);
  }

  const blocked = await checkRateLimitBuckets(keys);
  assert.equal(blocked.identifierBlocked, true);
  assert.equal(blocked.ipBlocked, false);

  await clearIdentifierRateLimit(keys.identifierHash);
  const reset = await checkRateLimitBuckets(keys);
  assert.equal(reset.identifierBlocked, false);

  const ipBucket = await prisma.authRateLimitBucket.findUniqueOrThrow({
    where: { scope_keyHash: { scope: 'IP', keyHash: keys.ipHash } }
  });
  assert.equal(ipBucket.attemptCount, IDENTIFIER_MAX_ATTEMPTS);
}

async function checkWindowExpiry() {
  const keys = rateLimitTestKeys('expiry');
  for (let attempt = 0; attempt < IDENTIFIER_MAX_ATTEMPTS; attempt += 1) {
    await recordRateLimitFailure(keys);
  }

  const now = Date.now();
  await prisma.authRateLimitBucket.updateMany({
    where: { keyHash: { in: [keys.identifierHash, keys.ipHash] } },
    data: {
      windowStart: new Date(now - 16 * 60 * 1000),
      blockedUntil: new Date(now - 60 * 1000)
    }
  });

  assert.equal((await checkRateLimitBuckets(keys)).blocked, false);
  await recordRateLimitFailure(keys);

  const rows = await prisma.authRateLimitBucket.findMany({
    where: { keyHash: { in: [keys.identifierHash, keys.ipHash] } }
  });
  assert.ok(rows.every((row) => row.attemptCount === 1 && row.blockedUntil === null));
}

async function checkConcurrentIncrements() {
  const keys = rateLimitTestKeys('concurrency');
  const attempts = 12;
  await Promise.all(Array.from({ length: attempts }, () => recordRateLimitFailure(keys)));

  const rows = await prisma.authRateLimitBucket.findMany({
    where: { keyHash: { in: [keys.identifierHash, keys.ipHash] } }
  });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.attemptCount === attempts));
  assert.equal((await checkRateLimitBuckets(keys)).identifierBlocked, true);
}

async function checkIpThresholdAndDualPolicy() {
  const keys = Array.from({ length: IP_MAX_ATTEMPTS }, (_, index) =>
    rateLimitTestKeys(`ip-identifier-${index}`, 'shared-ip')
  );

  for (let index = 0; index < keys.length; index += 1) {
    const decision = await recordRateLimitFailure(keys[index]);
    assert.equal(decision.ipBlocked, index === IP_MAX_ATTEMPTS - 1);
  }

  const emptyIdentifier = rateLimitTestKeys('dual-empty').identifierHash;
  const ipBlocked = await checkRateLimitBuckets({
    identifierHash: emptyIdentifier,
    ipHash: keys[0].ipHash
  });
  assert.equal(ipBlocked.identifierBlocked, false);
  assert.equal(ipBlocked.ipBlocked, true);
  assert.equal(ipBlocked.blocked, true);

  const separateIp = rateLimitTestKeys('dual-empty');
  assert.equal((await checkRateLimitBuckets(separateIp)).blocked, false);
}

function checkSourceContracts() {
  const authConfig = read('lib/auth/config.ts');
  const store = read('lib/auth/rate-limit-store.ts');
  const actions = read('app/(auth)/actions.ts');

  assert.match(authConfig, /async authorize\(credentials, request\)/);
  assert.match(authConfig, /prepareCredentialsRateLimit/);
  assert.match(authConfig, /recordCredentialsFailure/);
  assert.match(authConfig, /resetSuccessfulIdentifier/);
  assert.match(store, /ON CONFLICT \("scope", "keyHash"\) DO UPDATE/);
  assert.doesNotMatch(store, /\$queryRawUnsafe|\$executeRawUnsafe/);
  assert.doesNotMatch(actions, /user\?\.role === 'CLIENT'/);
  assert.match(actions, /error\.code === 'rate-limit'/);
  assert.match(actions, /error\.code === 'auth-unavailable'/);
  assert.match(actions, /credentialsSignInCode\(result\)/);
  assert.match(actions, /searchParams\.get\('code'\)/);
}

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function deleteTestBuckets(hashes: string[]) {
  return prisma.authRateLimitBucket.deleteMany({ where: { keyHash: { in: hashes } } });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Stage Client Auth 2C checks failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
