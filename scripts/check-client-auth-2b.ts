import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DUMMY_PASSWORD_HASH,
  evaluateCredentialCandidate,
  isRoleAllowedForLoginScope,
  parseLoginIdentifier,
  type CredentialCandidate
} from '@/lib/auth/credentials';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

async function main() {
const canonical = '+380680087708';
for (const value of ['0680087708', '380680087708', canonical, '(068) 008 77 08', '+38 (068) 008-77-08']) {
  assert.equal(normalizeUkrainianPhone(value), canonical);
}
for (const value of ['+38000000000', '068008770', '06800877088', '+48123456789', 'abc', '']) {
  assert.equal(normalizeUkrainianPhone(value), null);
}

assert.deepEqual(parseLoginIdentifier(' CLIENT@EXAMPLE.TEST ', 'CLIENT'), { kind: 'email', value: 'client@example.test' });
assert.deepEqual(parseLoginIdentifier(canonical, 'CLIENT'), { kind: 'phone', value: canonical });
assert.deepEqual(parseLoginIdentifier('068 008 77 08', 'CLIENT'), { kind: 'phone', value: canonical });
assert.equal(parseLoginIdentifier('0680087708', 'STAFF'), null);
assert.equal(parseLoginIdentifier('invalid', 'CLIENT'), null);
assert.equal(parseLoginIdentifier('', 'CLIENT'), null);

assert.equal(isRoleAllowedForLoginScope('CLIENT', 'CLIENT'), true);
assert.equal(isRoleAllowedForLoginScope('ADMIN', 'CLIENT'), false);
assert.equal(isRoleAllowedForLoginScope('MANAGER', 'CLIENT'), false);
assert.equal(isRoleAllowedForLoginScope('ADMIN', 'STAFF'), true);
assert.equal(isRoleAllowedForLoginScope('MANAGER', 'STAFF'), true);
assert.equal(isRoleAllowedForLoginScope('CLIENT', 'STAFF'), false);

const baseCandidate: CredentialCandidate = {
  id: 'fixture-user',
  email: 'fixture@example.test',
  name: 'Fixture',
  role: 'CLIENT',
  status: 'ACTIVE',
  authVersion: 1,
  passwordHash: 'fixture-hash'
};
const acceptsFixtureHash = async (_password: string, hash: string) => hash === 'fixture-hash';
const rejectsPassword = async () => false;

assert.equal((await evaluateCredentialCandidate({ candidate: baseCandidate, password: 'correct', scope: 'CLIENT', verify: acceptsFixtureHash })).ok, true);
assert.equal((await evaluateCredentialCandidate({ candidate: baseCandidate, password: 'wrong', scope: 'CLIENT', verify: rejectsPassword })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: null, password: 'unknown', scope: 'CLIENT', verify: async (_password, hash) => {
  assert.equal(hash, DUMMY_PASSWORD_HASH);
  return false;
} })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, status: 'DISABLED' }, password: 'correct', scope: 'CLIENT', verify: acceptsFixtureHash })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, status: 'INVITED' }, password: 'correct', scope: 'CLIENT', verify: acceptsFixtureHash })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, passwordHash: null }, password: 'correct', scope: 'CLIENT', verify: acceptsFixtureHash })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, role: 'ADMIN' }, password: 'correct', scope: 'CLIENT', verify: acceptsFixtureHash })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, role: 'MANAGER' }, password: 'correct', scope: 'CLIENT', verify: acceptsFixtureHash })).ok, false);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, role: 'ADMIN' }, password: 'correct', scope: 'STAFF', verify: acceptsFixtureHash })).ok, true);
assert.equal((await evaluateCredentialCandidate({ candidate: { ...baseCandidate, role: 'MANAGER' }, password: 'correct', scope: 'STAFF', verify: acceptsFixtureHash })).ok, true);

const authConfig = read('lib/auth/config.ts');
assert.match(authConfig, /role:\s*'CLIENT',\s*normalizedPhone:\s*identifier\.value/);
assert.match(authConfig, /role:\s*\{ in:\s*\['ADMIN', 'MANAGER'\]\s*\}/);
assert.doesNotMatch(authConfig, /normalizedPhone:\s*\{\s*(?:contains|startsWith|endsWith)/);
assert.match(authConfig, /evaluateCredentialCandidate/);
assert.match(authConfig, /authVersion:\s*true/);

const actions = read('app/(auth)/actions.ts');
assert.match(actions, /normalizedPhone:\s*phone/);
assert.match(actions, /loginScope:\s*'CLIENT'/);
assert.match(actions, /loginScope:\s*'STAFF'/);
assert.match(actions, /PrismaClientKnownRequestError/);
assert.match(actions, /error\.code === 'P2002'/);

const telegram = read('lib/telegram/session.ts');
assert.match(telegram, /data:\s*\{ phone:\s*normalizedPhone, normalizedPhone \}/);
assert.match(telegram, /update:\s*\{ phone, normalizedPhone:\s*phone \}/);

const clientForm = read('app/(auth)/login/login-form.tsx');
assert.match(clientForm, /name="identifier"/);
assert.match(clientForm, /autoComplete="username"/);
assert.match(clientForm, /autoCapitalize="none"/);
assert.match(clientForm, /spellCheck=\{false\}/);

const staffForm = read('app/(staff-auth)/admin/login/staff-login-form.tsx');
assert.match(staffForm, /name="email"/);
assert.match(staffForm, /type="email"/);

const clientLoginPage = read('app/(auth)/login/page.tsx');
const genericMessage = 'Невірний email, номер телефону або пароль.';
assert.ok((clientLoginPage.match(new RegExp(genericMessage, 'g')) ?? []).length >= 5);

const schema = read('prisma/schema.prisma');
assert.match(schema, /normalizedPhone\s+String\?\s+@unique/);

console.log('Stage Client Auth 2B targeted checks passed.');
}

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage Client Auth 2B targeted checks failed.');
  process.exitCode = 1;
});
