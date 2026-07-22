import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED,
  EQUIPMENT_TEXT_FIELD_MAX_LENGTH
} from '@/lib/features/equipment-taxonomy';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
import {
  buildEquipmentTypePrompt,
  buildManufacturerPrompt,
  buildRegistrationKeyboard,
  buildRegistrationRequiredMessage
} from '@/lib/telegram/messages';
import { validateManualEquipmentField } from '@/lib/telegram/request-fields';

const projectRoot = resolve(import.meta.dirname, '..');
const sessionSource = readFileSync(resolve(projectRoot, 'lib/telegram/session.ts'), 'utf8');

assert.equal(EQUIPMENT_TAXONOMY_TELEGRAM_FIELDS_ENABLED, false);
assert.match(buildEquipmentTypePrompt(), /Вкажіть тип техніки/);
assert.match(buildManufacturerPrompt(), /Вкажіть виробника або марку техніки/);

for (const phone of ['+380501111111', '380501111111', '0501111111', '+38 (050) 111-11-11']) {
  assert.equal(normalizeUkrainianPhone(phone), '+380501111111');
}

for (const value of ['Комбайн', 'John Deere', 'MAN-18', 'Трактор 8430']) {
  assert.deepEqual(validateManualEquipmentField(`  ${value}  `), { ok: true, value });
}

assert.deepEqual(validateManualEquipmentField('   '), { ok: false, reason: 'required' });
assert.deepEqual(
  validateManualEquipmentField('x'.repeat(EQUIPMENT_TEXT_FIELD_MAX_LENGTH + 1)),
  { ok: false, reason: 'too_long' }
);

const registrationKeyboard = buildRegistrationKeyboard('https://example.test/') as {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};
assert.deepEqual(registrationKeyboard.inline_keyboard.flat().map((button) => button.text), ['Зареєструватися']);
assert.equal(registrationKeyboard.inline_keyboard[0][0].url, 'https://example.test/register?next=/request');
assert.doesNotMatch(buildRegistrationRequiredMessage(), /увій/i);

const requestCreateBlock = sessionSource.match(/const createdRequest = await prisma\.request\.create\(\{[\s\S]*?\n  \}\);/u)?.[0];
assert.ok(requestCreateBlock, 'Telegram request create block must exist.');
assert.doesNotMatch(requestCreateBlock, /requestNumber\s*:/u);
assert.match(requestCreateBlock, /source:\s*'TELEGRAM'/u);
assert.match(requestCreateBlock, /manufacturerId,/u);
assert.match(requestCreateBlock, /manufacturerName,/u);
assert.match(requestCreateBlock, /equipmentType,/u);
assert.match(sessionSource, /step:\s*'CREATING'/u);
assert.match(sessionSource, /step:\s*'AWAITING_REGISTRATION'/u);

console.log('Telegram request flow checks passed.');
