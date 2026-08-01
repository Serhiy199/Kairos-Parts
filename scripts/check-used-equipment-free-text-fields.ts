import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildUsedEquipmentTitle } from '../lib/used-equipment/title';
import {
  getUsedEquipmentFormValues,
  validateUsedEquipmentForm
} from '../lib/used-equipment/validation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function formData(input: {
  type: string;
  manufacturer: string;
  model: string;
  year?: string;
}) {
  const data = new FormData();
  data.set('type', input.type);
  data.set('manufacturer', input.manufacturer);
  data.set('model', input.model);
  data.set('year', input.year ?? '');
  data.set('description', '<p>Перевірений опис техніки для продажу.</p>');
  data.set('status', 'DRAFT');
  return data;
}

function main() {
  assert.equal(
    buildUsedEquipmentTitle({
      type: '  Трактор ',
      manufacturer: ' John Deere ',
      model: ' 6155M ',
      year: 2020
    }),
    'Трактор John Deere 6155M 2020'
  );
  assert.equal(
    buildUsedEquipmentTitle({
      type: 'Обприскувач',
      manufacturer: 'Amazone',
      model: 'UX 5200',
      year: null
    }),
    'Обприскувач Amazone UX 5200'
  );

  for (const input of [
    { type: 'Самохідний обприскувач', manufacturer: 'ТОВ Агромаш Україна', model: 'Custom-X', year: '2021' },
    { type: 'Нестандартна агротехніка', manufacturer: 'Custom Brand-123', model: 'UX 5200', year: '2018' },
    { type: 'Міні-навантажувач', manufacturer: 'Невідомий виробник', model: '6155M' }
  ]) {
    const values = getUsedEquipmentFormValues(formData(input));
    const result = validateUsedEquipmentForm(values, { allowStatusEdit: false });
    assert.equal(result.ok, true, `Arbitrary free-text values must pass: ${JSON.stringify(input)}`);
    if (result.ok) {
      assert.equal(result.data.type, input.type);
      assert.equal(result.data.manufacturer, input.manufacturer);
      assert.equal(result.data.model, input.model);
      assert.equal(result.data.title, buildUsedEquipmentTitle({
        type: input.type,
        manufacturer: input.manufacturer,
        model: input.model,
        year: input.year ? Number(input.year) : null
      }));
    }
  }

  for (const field of ['type', 'manufacturer', 'model'] as const) {
    const input = {
      type: 'Трактор',
      manufacturer: 'John Deere',
      model: '6155M',
      [field]: '   '
    };
    assert.equal(
      validateUsedEquipmentForm(
        getUsedEquipmentFormValues(formData(input)),
        { allowStatusEdit: false }
      ).ok,
      false,
      `${field} must reject whitespace-only values.`
    );
  }

  const form = source('components/used-equipment/used-equipment-form.tsx');
  const actions = source('app/admin/used-equipment/items/actions.ts');
  const newPage = source('app/admin/used-equipment/items/new/page.tsx');
  const editPage = source('app/admin/used-equipment/items/[id]/edit/page.tsx');
  const queries = source('lib/used-equipment/queries.ts');
  const publicCard = source('components/used-equipment/public-used-equipment-card.tsx');
  const publicDetail = source('app/(public)/used-equipment/[slug]/page.tsx');
  const adminList = source('app/admin/used-equipment/items/page.tsx');
  const inquiryAction = source('app/(public)/used-equipment/actions.ts');
  const schema = source('prisma/schema.prisma');
  const statuses = source('lib/used-equipment/status.ts');

  assert.match(form, /type="text"\s+name="type"/);
  assert.match(form, /type="text"\s+name="manufacturer"/);
  assert.match(form, /type="text"\s+name="model"/);
  assert.doesNotMatch(form, /name="title"/);
  assert.doesNotMatch(form, /SearchableCombobox|manufacturerOptions|equipmentTypeOptions|<datalist/);
  assert.doesNotMatch(form, /disabled=\{!equipmentType\}/);
  assert.doesNotMatch(actions, /validateEquipmentTaxonomySelection/);
  assert.match(actions, /title: validation\.data\.title/);
  assert.match(actions, /manufacturerId: null/);
  assert.match(actions, /model: validation\.data\.model/);
  assert.equal((actions.match(/validateUsedEquipmentForm\(/g) ?? []).length, 2);
  assert.doesNotMatch(newPage, /getActiveEquipmentTaxonomy|taxonomy=/);
  assert.doesNotMatch(editPage, /getActiveEquipmentTaxonomy|taxonomy=/);
  assert.match(editPage, /model: item\.model \?\? ''/);
  assert.match(queries, /title: true/);
  assert.match(publicCard, /item\.title/);
  assert.match(publicDetail, /item\.title/);
  assert.match(adminList, /item\.title/);
  assert.match(inquiryAction, /equipmentTitle: equipment\.title/);

  const usedEquipmentModel = schema.slice(
    schema.indexOf('model UsedEquipment {'),
    schema.indexOf('model UsedEquipmentImage {')
  );
  assert.match(usedEquipmentModel, /title\s+String/);
  assert.match(usedEquipmentModel, /equipmentType\s+String/);
  assert.match(usedEquipmentModel, /manufacturerName\s+String/);
  assert.match(usedEquipmentModel, /model\s+String\?/);
  assert.match(usedEquipmentModel, /year\s+Int\?/);
  assert.match(statuses, /DRAFT:[\s\S]*PUBLISHED:[\s\S]*ARCHIVED:/);
  assert.doesNotMatch(statuses, /RESERVED|SOLD/);

  console.log('Used Equipment free-text fields and automatic title checks passed.');
}

main();
