import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { EQUIPMENT_TEXT_FIELD_MAX_LENGTH } from '../lib/features/equipment-taxonomy';
import {
  parseRequestItemInput,
  parseRequestItemUpdateInput
} from '../lib/request-items/validation';

const root = path.resolve(__dirname, '..');
let checks = 0;

function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks += 1;
}

function createInput(brand: string) {
  return {
    brand,
    name: 'Тестова запчастина',
    quantity: '1',
    unit: 'шт',
    currency: 'UAH'
  };
}

function updateInput(brand: string) {
  return {
    brand,
    name: 'Тестова запчастина',
    quantity: '1',
    unit: 'шт',
    currency: 'UAH'
  };
}

const pagePath = path.join(root, 'app', 'admin', 'requests', '[id]', 'page.tsx');
const pageSource = fs.readFileSync(pagePath, 'utf8');
const manufacturerFieldStart = pageSource.indexOf('function PartManufacturerField');
const manufacturerFieldEnd = pageSource.indexOf('function TextField', manufacturerFieldStart);

check(manufacturerFieldStart >= 0 && manufacturerFieldEnd > manufacturerFieldStart, 'Manufacturer field source must exist.');
const manufacturerFieldSource = pageSource.slice(manufacturerFieldStart, manufacturerFieldEnd);

check(manufacturerFieldSource.includes('type="text"'), 'Manufacturer must render as a text input.');
check(manufacturerFieldSource.includes('name="brand"'), 'Manufacturer input must keep the server field name.');
check(manufacturerFieldSource.includes('required'), 'Manufacturer input must remain required.');
check(
  manufacturerFieldSource.includes(`maxLength={${EQUIPMENT_TEXT_FIELD_MAX_LENGTH}}`),
  'Manufacturer input must expose the server-side maximum length.'
);
check(
  manufacturerFieldSource.includes('placeholder="Наприклад: Bosch або John Deere"'),
  'Manufacturer input must explain that arbitrary text is accepted.'
);
check(!/\blist=|<datalist|<select|combobox/i.test(manufacturerFieldSource), 'Manufacturer field must not use list, datalist, select, or combobox UI.');
check(!pageSource.includes('PART_MANUFACTURERS'), 'Request item page must not use the legacy manufacturer allowlist.');
check(
  !fs.existsSync(path.join(root, 'lib', 'parts', 'part-manufacturers.ts')),
  'Unused legacy manufacturer list must be removed.'
);

const arbitraryManufacturers = [
  'Agro Parts Custom',
  'John Deere Original',
  'ТОВ Виробник Україна',
  'Brand-123',
  'Невідомий виробник',
  'Public'
];

for (const manufacturer of arbitraryManufacturers) {
  const createResult = parseRequestItemInput(createInput(`  ${manufacturer}  `));
  check(createResult.ok && createResult.data.brand === manufacturer, `Create validation must accept and trim: ${manufacturer}`);

  const updateResult = parseRequestItemUpdateInput(updateInput(`  ${manufacturer}  `));
  check(updateResult.ok && updateResult.data.brand === manufacturer, `Update validation must accept and trim: ${manufacturer}`);
}

check(!parseRequestItemInput(createInput('   ')).ok, 'Create validation must reject whitespace-only manufacturer.');
check(!parseRequestItemUpdateInput(updateInput('\t  ')).ok, 'Update validation must reject whitespace-only manufacturer.');
check(
  !parseRequestItemInput(createInput('x'.repeat(EQUIPMENT_TEXT_FIELD_MAX_LENGTH + 1))).ok,
  'Create validation must reject manufacturer values above the maximum length.'
);
check(
  !parseRequestItemUpdateInput(updateInput('x'.repeat(EQUIPMENT_TEXT_FIELD_MAX_LENGTH + 1))).ok,
  'Update validation must reject manufacturer values above the maximum length.'
);

const schemaSource = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const requestItemModelStart = schemaSource.indexOf('model RequestItem {');
const requestItemModelEnd = schemaSource.indexOf('\n}', requestItemModelStart);
const requestItemModelSource = schemaSource.slice(requestItemModelStart, requestItemModelEnd);
check(/\n\s+brand\s+String\?/.test(requestItemModelSource), 'RequestItem.brand must remain a String field.');

console.log(
  `requestItemManufacturerFreeText=PASS checks=${checks} arbitraryValues=${arbitraryManufacturers.length}`
);
