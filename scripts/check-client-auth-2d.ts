import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatLocalPhoneDigits,
  formatPhoneIdentifierInput,
  removeMaskedPhoneDigit
} from '@/lib/phone/client-format';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

const canonical = '+380730031900';
const display = '+38 (073) 003-19-00';

for (const input of [
  '0730031900',
  canonical,
  '+38 (073) 003-19-00',
  '073 003 19 00',
  '073-003-19-00',
  '(073) 003-19-00'
]) {
  assert.deepEqual(formatPhoneIdentifierInput(input), {
    canonical,
    display,
    isPhoneLike: true,
    localDigits: '0730031900'
  });
  assert.equal(normalizeUkrainianPhone(input), canonical);
}

assert.equal(formatPhoneIdentifierInput('0730031900999').display, display);
assert.equal(formatPhoneIdentifierInput('+380730031900999').display, display);
assert.equal(formatPhoneIdentifierInput('073003190').canonical, null);
assert.equal(formatPhoneIdentifierInput('phone').isPhoneLike, false);
assert.equal(formatPhoneIdentifierInput('073a').isPhoneLike, false);
assert.equal(normalizeUkrainianPhone(display), canonical);

const backspace = removeMaskedPhoneDigit(display, display.length, display.length, 'backward');
assert.equal(backspace?.display, formatLocalPhoneDigits('073003190'));

const subscriberStart = display.indexOf('003');
const deleteForward = removeMaskedPhoneDigit(display, subscriberStart, subscriberStart, 'forward');
assert.equal(deleteForward?.display, formatLocalPhoneDigits('073031900'));

assert.equal(new Set(['0730031900', canonical, display].map(normalizeUkrainianPhone)).size, 1);

const registerForm = read('app/(auth)/register/register-form.tsx');
const actions = read('app/(auth)/actions.ts');

assert.match(registerForm, /formatPhoneIdentifierInput/);
assert.match(registerForm, /removeMaskedPhoneDigit/);
assert.match(registerForm, /if \(!parsed\.isPhoneLike\) return/);
assert.match(registerForm, /onSubmit=\{handleSubmit\}/);
assert.match(registerForm, /name="phone"/);
assert.equal(registerForm.match(/name="phone"/g)?.length, 1);
assert.match(registerForm, /inputMode="tel"/);
assert.match(registerForm, /autoComplete="tel"/);
assert.match(registerForm, /placeholder="\+38 \(0XX\) XXX-XX-XX"/);
assert.ok(registerForm.includes('pattern="\\+38 \\(0\\d{2}\\) \\d{3}-\\d{2}-\\d{2}"'));
assert.match(registerForm, /'BUSINESS', 'INDIVIDUAL'/);
assert.match(registerForm, /ФОП \/ Юр особа/);
assert.match(registerForm, /Фіз особа/);

const registerAction = actions.slice(
  actions.indexOf('export async function registerClient'),
  actions.indexOf('export async function loginClient')
);
assert.match(registerAction, /rawPhone\s*=\s*readString\(formData, 'phone'\)/);
assert.match(registerAction, /phone\s*=\s*normalizeUkrainianPhone\(rawPhone\)/);
assert.match(registerAction, /OR:\s*\[\{ email \}, \{ normalizedPhone: phone \}\]/);
assert.match(registerAction, /phone,\s*\n\s*normalizedPhone: phone/);
assert.match(registerAction, /clientProfile:\s*\{[\s\S]*?phone,/);
assert.match(registerAction, /error\.code === 'P2002'/);

console.log('clientAuth2D=PASS registrationFlows=2 canonicalStorage=PASS');

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
