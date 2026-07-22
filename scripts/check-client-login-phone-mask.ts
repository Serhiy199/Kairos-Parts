import assert from 'node:assert/strict';

import {
  formatPhoneIdentifierInput,
  removeMaskedPhoneDigit
} from '@/lib/phone/client-format';

const canonical = '+380955305553';
const display = '+38 (095) 530-55-53';

for (const input of [
  '0955305553',
  '380955305553',
  '+380955305553',
  '+38 (095) 530-55-53',
  '(095) 530-55-53',
  '095 530 55 53',
  '095-530-55-53'
]) {
  assert.deepEqual(formatPhoneIdentifierInput(input), {
    canonical,
    display,
    isPhoneLike: true,
    localDigits: '0955305553'
  });
}

assert.equal(formatPhoneIdentifierInput('0').display, '+38 (0');
assert.equal(formatPhoneIdentifierInput('0955').display, '+38 (095) 5');
assert.equal(formatPhoneIdentifierInput('+3').display, '+3');
assert.equal(formatPhoneIdentifierInput('+38').display, '+38');
assert.equal(formatPhoneIdentifierInput('+380').display, '+38 (0');
assert.equal(formatPhoneIdentifierInput('380').display, '+38 (0');
assert.equal(formatPhoneIdentifierInput('0955305553999').display, display);
assert.equal(formatPhoneIdentifierInput('+380955305553999').display, display);
assert.equal(formatPhoneIdentifierInput('095530555').canonical, null);

for (const email of ['a', 'name@', 'name@example.com']) {
  assert.equal(formatPhoneIdentifierInput(email).isPhoneLike, false);
  assert.equal(formatPhoneIdentifierInput(email).display, email);
}

const backspace = removeMaskedPhoneDigit(display, display.length, display.length, 'backward');
assert.equal(backspace?.display, '+38 (095) 530-55-5');

const deleteAtSubscriberStart = removeMaskedPhoneDigit(display, 10, 10, 'forward');
assert.equal(deleteAtSubscriberStart?.display, '+38 (095) 305-55-3');

console.log('clientLoginPhoneMask=PASS');
