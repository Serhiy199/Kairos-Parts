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
  buildRegistrationRequiredMessage,
  buildVehicleLabel,
  buildVehicleSelectionKeyboard,
  TELEGRAM_CALLBACKS,
  TELEGRAM_VEHICLE_PAGE_SIZE
} from '@/lib/telegram/messages';
import { validateManualEquipmentField } from '@/lib/telegram/request-fields';
import { vehicleAccessWhereForClient } from '@/lib/vehicles/ownership';

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

assert.equal(buildVehicleLabel({ name: 'Основний трактор', type: 'Трактор', manufacturer: 'John Deere', model: '8430', year: 2018 }), 'Основний трактор — John Deere 8430 · 2018');
assert.equal(buildVehicleLabel({ name: 'John Deere 8430', type: 'Трактор', manufacturer: 'John Deere', model: '8430', year: null }), 'John Deere 8430');
assert.equal(buildVehicleLabel({ name: 'Техніка', type: '', manufacturer: '', model: '', year: null }), 'Техніка');
assert.ok(buildVehicleLabel({ name: 'x'.repeat(80), type: '', manufacturer: '', model: '', year: null }).length <= 56);

const vehicleOptions = Array.from({ length: TELEGRAM_VEHICLE_PAGE_SIZE }, (_, index) => ({
  id: `cmr-vehicle-${index}`,
  name: `Трактор ${index + 1}`,
  type: 'Трактор',
  manufacturer: 'John Deere',
  model: String(8430 + index),
  year: 2018
}));
const vehicleKeyboard = buildVehicleSelectionKeyboard({ vehicles: vehicleOptions, page: 0, totalPages: 2 });
const vehicleButtons = vehicleKeyboard.inline_keyboard.flat();
assert.equal(vehicleButtons.filter((button) => button.callback_data.startsWith(TELEGRAM_CALLBACKS.vehiclePrefix)).length, TELEGRAM_VEHICLE_PAGE_SIZE);
assert.ok(vehicleButtons.some((button) => button.callback_data === `${TELEGRAM_CALLBACKS.vehiclePagePrefix}1`));
assert.ok(vehicleButtons.some((button) => button.callback_data === TELEGRAM_CALLBACKS.vehicleSkip));
assert.ok(vehicleButtons.every((button) => Buffer.byteLength(button.callback_data, 'utf8') <= 64));

assert.deepEqual(vehicleAccessWhereForClient({ clientProfileId: 'client-1', companyId: null }), {
  clientId: 'client-1',
  companyId: null
});
assert.deepEqual(vehicleAccessWhereForClient({ clientProfileId: 'client-1', companyId: 'company-1' }), {
  OR: [
    { companyId: 'company-1', clientId: null },
    { clientId: 'client-1', companyId: null }
  ]
});

const requestCreateBlock = sessionSource.match(/const createdRequest = await prisma\.request\.create\(\{[\s\S]*?\n  \}\);/u)?.[0];
assert.ok(requestCreateBlock, 'Telegram request create block must exist.');
assert.doesNotMatch(requestCreateBlock, /requestNumber\s*:/u);
assert.match(requestCreateBlock, /source:\s*'TELEGRAM'/u);
assert.match(requestCreateBlock, /manufacturerId,/u);
assert.match(requestCreateBlock, /manufacturerName,/u);
assert.match(requestCreateBlock, /equipmentType,/u);
assert.match(requestCreateBlock, /vehicleId,/u);
assert.match(sessionSource, /step:\s*'CREATING'/u);
assert.match(sessionSource, /step:\s*'AWAITING_REGISTRATION'/u);
assert.match(sessionSource, /step:\s*'SELECT_VEHICLE'/u);
assert.match(sessionSource, /vehicleAccessWhereForClient/u);
assert.match(sessionSource, /archivedAt:\s*null/u);
assert.match(sessionSource, /await findAvailableVehicle\(clientProfile, metadata\.vehicleId\)/u);

console.log('Telegram request flow checks passed.');
