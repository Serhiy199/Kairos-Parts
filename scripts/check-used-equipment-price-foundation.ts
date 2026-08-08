import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { canUseUsedEquipmentStatusWithImageCount } from '../lib/used-equipment/images';
import {
  formatUsedEquipmentPrice,
  parseUsedEquipmentPrice,
  USED_EQUIPMENT_PRICE_MAX
} from '../lib/used-equipment/price';
import { validateUsedEquipmentForm, type UsedEquipmentFormValues } from '../lib/used-equipment/validation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function values(overrides: Partial<UsedEquipmentFormValues> = {}): UsedEquipmentFormValues {
  return {
    type: 'Комбайн',
    manufacturer: 'Claas',
    model: 'Lexion 600',
    year: '2020',
    priceAmount: '1 250 000',
    description: '<p>Перевірений опис техніки для продажу.</p>',
    internalComment: '',
    status: 'DRAFT',
    ...overrides
  };
}

function main() {
  for (const [input, expected] of [
    ['1', 1],
    ['1250000', 1_250_000],
    ['1 250 000', 1_250_000],
    ['1\u00a0250\u00a0000', 1_250_000],
    ['1\u202f250\u202f000', 1_250_000],
    [String(USED_EQUIPMENT_PRICE_MAX), USED_EQUIPMENT_PRICE_MAX]
  ] as const) {
    const result = parseUsedEquipmentPrice(input);
    assert.equal(result.ok, true, `${JSON.stringify(input)} must be accepted.`);
    if (result.ok) {
      assert.equal(result.value, expected);
      assert.equal(result.normalized, String(expected));
    }
  }

  for (const input of [
    '',
    '   ',
    '0',
    '-1',
    '1.5',
    '1,5',
    '1e3',
    'UAH 100',
    '2 147 483 648',
    '\t100',
    '100\n'
  ]) {
    assert.equal(parseUsedEquipmentPrice(input).ok, false, `${JSON.stringify(input)} must be rejected.`);
  }

  assert.equal(formatUsedEquipmentPrice(1_250_000), '1 250 000 грн');
  assert.doesNotMatch(formatUsedEquipmentPrice(1_250_000), /[\u00a0\u202f]/);
  assert.throws(() => formatUsedEquipmentPrice(0), RangeError);
  assert.throws(() => formatUsedEquipmentPrice(USED_EQUIPMENT_PRICE_MAX + 1), RangeError);

  const validCreate = validateUsedEquipmentForm(values(), { allowStatusEdit: false });
  assert.equal(validCreate.ok, true);
  if (validCreate.ok) {
    assert.equal(validCreate.data.priceAmount, 1_250_000);
  }

  for (const priceAmount of ['', '0', '-100', '1.25', '2147483648']) {
    const result = validateUsedEquipmentForm(values({ priceAmount }), { allowStatusEdit: false });
    assert.equal(result.ok, false, `Create must reject ${JSON.stringify(priceAmount)}.`);
    if (!result.ok) {
      assert.ok(result.fieldErrors.priceAmount);
    }
  }

  const publishedWithoutPrice = validateUsedEquipmentForm(
    values({ priceAmount: '', status: 'PUBLISHED' }),
    { allowStatusEdit: true }
  );
  assert.equal(publishedWithoutPrice.ok, false);
  if (!publishedWithoutPrice.ok) {
    assert.ok(publishedWithoutPrice.fieldErrors.priceAmount);
    assert.ok(publishedWithoutPrice.fieldErrors.status);
  }

  assert.equal(
    validateUsedEquipmentForm(values({ status: 'PUBLISHED' }), { allowStatusEdit: true }).ok,
    true
  );
  assert.equal(canUseUsedEquipmentStatusWithImageCount('PUBLISHED', 0), false);
  assert.equal(canUseUsedEquipmentStatusWithImageCount('PUBLISHED', 1), true);
  assert.equal(canUseUsedEquipmentStatusWithImageCount('DRAFT', 0), true);

  const migration = source('prisma/migrations/20260808190000_add_used_equipment_price_foundation/migration.sql');
  assert.match(migration, /ADD COLUMN "priceAmount" INTEGER;/);
  assert.match(migration, /"priceAmount" IS NULL\s+OR "priceAmount" > 0/);
  assert.doesNotMatch(migration, /NOT NULL|DEFAULT|UPDATE|currency/i);

  const actions = source('app/admin/used-equipment/items/actions.ts');
  assert.equal((actions.match(/priceAmount: validation\.data\.priceAmount/g) ?? []).length, 2);

  const form = source('components/used-equipment/used-equipment-form.tsx');
  assert.doesNotMatch(form, /name="priceAmount"/);

  for (const path of [
    'components/used-equipment/public-used-equipment-card.tsx',
    'app/(public)/used-equipment/[slug]/page.tsx',
    'app/admin/used-equipment/items/page.tsx',
    'app/(public)/used-equipment/actions.ts'
  ]) {
    const contents = source(path);
    assert.doesNotMatch(contents, /priceAmount|formatUsedEquipmentPrice/, `${path} must remain unchanged by the foundation stage.`);
  }

  console.log('Used Equipment price foundation checks passed.');
}

main();
