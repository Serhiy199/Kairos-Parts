import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatUsedEquipmentPriceOrFallback,
  parseUsedEquipmentPrice
} from '../lib/used-equipment/price';
import { validateUsedEquipmentForm, type UsedEquipmentFormValues } from '../lib/used-equipment/validation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function values(priceAmount: string, status: UsedEquipmentFormValues['status'] = 'DRAFT'): UsedEquipmentFormValues {
  return {
    type: 'Комбайн',
    manufacturer: 'Claas',
    model: 'Lexion 600',
    year: '2020',
    priceAmount,
    description: '<p>Перевірений опис техніки для продажу.</p>',
    internalComment: '',
    status
  };
}

function main() {
  for (const input of ['1250000', '1 250 000']) {
    const result = validateUsedEquipmentForm(values(input), { allowStatusEdit: false });
    assert.equal(result.ok, true, `${input} must pass create validation.`);
    if (result.ok) {
      assert.equal(result.data.priceAmount, 1_250_000);
    }
  }

  for (const input of ['', '0', '-1', '100.50', 'abc', '2147483648']) {
    const result = validateUsedEquipmentForm(values(input), { allowStatusEdit: false });
    assert.equal(result.ok, false, `${JSON.stringify(input)} must fail create validation.`);
    if (!result.ok) {
      assert.ok(result.fieldErrors.priceAmount);
    }
  }

  assert.equal(parseUsedEquipmentPrice('1 250 000').ok, true);
  assert.equal(validateUsedEquipmentForm(values('1250000'), { allowStatusEdit: true }).ok, true);
  assert.equal(validateUsedEquipmentForm(values('1 500 000'), { allowStatusEdit: true }).ok, true);
  assert.equal(validateUsedEquipmentForm(values('', 'PUBLISHED'), { allowStatusEdit: true }).ok, false);
  assert.equal(validateUsedEquipmentForm(values('1 250 000', 'PUBLISHED'), { allowStatusEdit: true }).ok, true);

  assert.equal(formatUsedEquipmentPriceOrFallback(1_250_000), '1 250 000 грн');
  assert.equal(formatUsedEquipmentPriceOrFallback(null), '—');

  const form = source('components/used-equipment/used-equipment-form.tsx');
  assert.match(form, /Ціна, грн \*/);
  assert.match(form, /type="text"[\s\S]*name="priceAmount"[\s\S]*inputMode="numeric"[\s\S]*required/);
  assert.match(form, /defaultValue=\{values\.priceAmount\}/);
  assert.match(form, /aria-describedby=\{state\.fieldErrors\?\.priceAmount/);
  assert.match(form, /FieldError error=\{state\.fieldErrors\?\.priceAmount\}/);

  const newPage = source('app/admin/used-equipment/items/new/page.tsx');
  assert.match(newPage, /priceAmount: ''/);

  const editPage = source('app/admin/used-equipment/items/[id]/edit/page.tsx');
  assert.match(editPage, /priceAmount: true/);
  assert.match(editPage, /priceAmount: item\.priceAmount === null \? '' : String\(item\.priceAmount\)/);

  const actions = source('app/admin/used-equipment/items/actions.ts');
  assert.equal((actions.match(/priceAmount: validation\.data\.priceAmount/g) ?? []).length, 2);
  assert.equal((actions.match(/requireCrmSession\(\)/g) ?? []).length, 2);

  const queries = source('lib/used-equipment/queries.ts');
  const adminQuery = queries.slice(
    queries.indexOf('export async function getAdminUsedEquipmentPage'),
    queries.indexOf('export async function getPublicUsedEquipmentPage')
  );
  assert.match(adminQuery, /priceAmount: true/);

  const list = source('app/admin/used-equipment/items/page.tsx');
  assert.match(list, /<th[^>]*>Ціна<\/th>/);
  assert.equal((list.match(/formatUsedEquipmentPriceOrFallback\(item\.priceAmount\)/g) ?? []).length, 2);
  assert.match(list, /min-w-\[1240px\]/);

  const access = source('lib/admin/access.ts');
  assert.match(access, /const CRM_ROLES: UserRole\[\] = \['MANAGER', 'ADMIN'\]/);
  assert.match(newPage, /requireCrmSession\(\)/);
  assert.match(editPage, /requireCrmSession\(\)/);
  assert.match(list, /requireCrmSession\(\)/);

  const inquiryAction = source('app/(public)/used-equipment/actions.ts');
  assert.doesNotMatch(inquiryAction, /priceAmount|formatUsedEquipmentPrice/);

  const priceMigrations = readdirSync(resolve(process.cwd(), 'prisma/migrations'))
    .filter((name) => name.includes('used_equipment_price'));
  assert.deepEqual(priceMigrations, ['20260808190000_add_used_equipment_price_foundation']);

  console.log('Used Equipment CRM price checks passed.');
}

main();
