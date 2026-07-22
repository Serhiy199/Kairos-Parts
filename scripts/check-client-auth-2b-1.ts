import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  evaluateCredentialCandidate,
  parseLoginIdentifier,
  type CredentialCandidate
} from '@/lib/auth/credentials';
import { formatPhoneIdentifierInput } from '@/lib/phone/client-format';

const canonicalPhone = '+380955305553';
const baseCandidate: CredentialCandidate = {
  id: 'fixture-client',
  email: 'client@example.test',
  name: 'Fixture client',
  role: 'CLIENT',
  status: 'ACTIVE',
  authVersion: 1,
  passwordHash: 'fixture-hash'
};
const acceptsFixtureHash = async (_password: string, hash: string) => hash === 'fixture-hash';

async function main() {
assert.deepEqual(parseLoginIdentifier(' CLIENT@EXAMPLE.TEST ', 'CLIENT'), {
  kind: 'email',
  value: 'client@example.test'
});
for (const phone of [canonicalPhone, '0955305553', '+38 (095) 530-55-53']) {
  assert.deepEqual(parseLoginIdentifier(phone, 'CLIENT'), { kind: 'phone', value: canonicalPhone });
}
assert.equal(parseLoginIdentifier('095530555', 'CLIENT'), null);
assert.equal(parseLoginIdentifier(canonicalPhone, 'STAFF'), null);

assert.equal((await evaluateCredentialCandidate({
  candidate: baseCandidate,
  password: 'correct',
  scope: 'CLIENT',
  verify: acceptsFixtureHash
})).ok, true);
assert.equal((await evaluateCredentialCandidate({
  candidate: { ...baseCandidate, role: 'ADMIN' },
  password: 'correct',
  scope: 'CLIENT',
  verify: acceptsFixtureHash
})).ok, false);
assert.equal((await evaluateCredentialCandidate({
  candidate: { ...baseCandidate, role: 'MANAGER' },
  password: 'correct',
  scope: 'STAFF',
  verify: acceptsFixtureHash
})).ok, true);

assert.equal(formatPhoneIdentifierInput(canonicalPhone).canonical, canonicalPhone);
assert.equal(formatPhoneIdentifierInput('095530555').canonical, null);
assert.equal(formatPhoneIdentifierInput('name@example.com').isPhoneLike, false);

const loginForm = read('app/(auth)/login/login-form.tsx');
assert.match(loginForm, /name="identifier"/);
assert.doesNotMatch(loginForm, /accountType|ФОП \/ Юр особа|Фіз особа|ЄДРПОУ/);
assert.match(loginForm, /name@example\.com або \+38 \(0XX\) XXX-XX-XX/);
assert.match(loginForm, /formatPhoneIdentifierInput/);
assert.match(loginForm, /pattern=\{identifierState\.isPhoneLike/);

const actions = read('app/(auth)/actions.ts');
assert.match(actions, /canonicalPhone\s*=\s*normalizeUkrainianPhone\(identifier\)/);
assert.match(actions, /identifier:\s*authIdentifier/);
assert.match(actions, /loginScope:\s*'CLIENT'/);
assert.doesNotMatch(actions.slice(actions.indexOf('export async function loginClient'), actions.indexOf('export async function loginStaff')), /accountType|edrpou|taxId|userType/);

const authConfig = read('lib/auth/config.ts');
assert.match(authConfig, /credentials:\s*\{[\s\S]*identifier:[\s\S]*password:[\s\S]*loginScope:/);
assert.match(authConfig, /role:\s*'CLIENT',\s*normalizedPhone:\s*identifier\.value/);
assert.match(authConfig, /role:\s*\{ in:\s*\['ADMIN', 'MANAGER'\]\s*\}/);

const registerForm = read('app/(auth)/register/register-form.tsx');
assert.match(registerForm, /accountType/);

console.log('clientAuth2B1=PASS');
}

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Stage Client Auth 2B.1 checks failed.');
  process.exitCode = 1;
});
