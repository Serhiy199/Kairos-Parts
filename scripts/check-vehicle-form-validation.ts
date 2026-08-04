import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  type AdminVehicleFormField,
  getAdminVehicleFormValues,
  type AdminVehicleFormValues,
  validateAdminVehicleForm
} from '../lib/vehicles/admin-validation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const validValues: AdminVehicleFormValues = {
  equipmentType: ' Трактор ',
  manufacturerId: 'manufacturer-1',
  manufacturer: ' John Deere ',
  model: ' 6155M ',
  year: '',
  vinOrSerial: ' jd-00 01 ',
  comment: ''
};

function expectFieldError(
  values: AdminVehicleFormValues,
  field: AdminVehicleFormField
) {
  const result = validateAdminVehicleForm(values);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.fieldErrors[field]);
}

function main() {
  const minimal = validateAdminVehicleForm(validValues);
  assert.equal(minimal.ok, true);
  if (minimal.ok) {
    assert.equal(minimal.data.equipmentType, 'Трактор');
    assert.equal(minimal.data.manufacturer, 'John Deere');
    assert.equal(minimal.data.model, '6155M');
    assert.equal(minimal.data.vinOrSerial, 'JD0001');
    assert.equal(minimal.data.year, null);
    assert.equal(minimal.data.comment, null);
  }

  expectFieldError({ ...validValues, equipmentType: '   ' }, 'equipmentType');
  const missingManufacturer = validateAdminVehicleForm({
    ...validValues,
    manufacturerId: '',
    manufacturer: '   '
  });
  assert.equal(missingManufacturer.ok, false);
  if (!missingManufacturer.ok) {
    assert.ok(
      missingManufacturer.fieldErrors.manufacturerId
      || missingManufacturer.fieldErrors.manufacturer
    );
  }
  expectFieldError({ ...validValues, model: '   ' }, 'model');
  expectFieldError({ ...validValues, vinOrSerial: '   ' }, 'vinOrSerial');
  expectFieldError({ ...validValues, vinOrSerial: 'N/A' }, 'vinOrSerial');

  const singleCharacterModel = validateAdminVehicleForm({ ...validValues, model: 'X' });
  assert.equal(singleCharacterModel.ok, true);

  const validYear = validateAdminVehicleForm({ ...validValues, year: '2020' });
  assert.equal(validYear.ok, true);
  if (validYear.ok) assert.equal(validYear.data.year, 2020);
  expectFieldError({ ...validValues, year: 'invalid' }, 'year');
  expectFieldError({ ...validValues, year: '1949' }, 'year');
  expectFieldError({ ...validValues, year: '2101' }, 'year');

  const absentOptionalFields = new FormData();
  absentOptionalFields.set('equipmentType', 'Трактор');
  absentOptionalFields.set('manufacturerId', 'manufacturer-1');
  absentOptionalFields.set('manufacturer', 'John Deere');
  absentOptionalFields.set('model', '6155M');
  absentOptionalFields.set('vinOrSerial', 'VIN-001');
  const parsed = getAdminVehicleFormValues(absentOptionalFields);
  assert.equal(parsed.year, '');
  assert.equal(parsed.comment, '');
  assert.equal(validateAdminVehicleForm(parsed).ok, true);

  const clientActions = source('app/client/vehicles/actions.ts');
  const crmActions = source('app/admin/vehicles/actions.ts');
  const coreFields = source('components/vehicles/vehicle-core-fields.tsx');
  const manualFields = source('components/vehicles/manual-equipment-fields.tsx');
  const combobox = source('components/ui/searchable-combobox.tsx');
  const clientForm = source('app/client/vehicles/vehicle-form.tsx');
  const crmForm = source('components/vehicles/admin-vehicle-form.tsx');
  const clientEdit = source('app/client/vehicles/[id]/page.tsx');
  const crmEdit = source('app/admin/vehicles/[vehicleId]/edit/page.tsx');
  const workflow = source('lib/vehicles/asset-workflow.ts');
  const schema = source('prisma/schema.prisma');

  assert.match(clientActions, /validateAdminVehicleForm\(values\)/);
  assert.match(crmActions, /validateAdminVehicleForm\(values\)/);
  assert.doesNotMatch(clientActions, /const parsedYear = Number/);
  assert.match(coreFields, /label="Модель"[\s\S]*required[\s\S]*requiredMessage="Вкажіть модель\."/);
  assert.match(coreFields, /label="VIN \/ серійний номер"[\s\S]*required[\s\S]*requiredMessage="Вкажіть VIN або серійний номер\."/);
  assert.match(coreFields, /label="Рік"[\s\S]*placeholder="Наприклад, 2020"/);
  assert.match(manualFields, /Наприклад: Комбайн, Трактор, Сівалка/);
  assert.match(manualFields, /Наприклад: John Deere, MAN, Claas/);
  assert.match(combobox, /required && !value \? 'Оберіть значення зі списку\.' : ''/);
  assert.match(combobox, /required=\{required\}/);
  assert.doesNotMatch(coreFields, /label="Рік"[\s\S]{0,220}required/);
  assert.doesNotMatch(coreFields, /Опис \/ примітка\s*\*/);

  for (const form of [clientForm, crmForm]) {
    assert.match(form, /<VehicleImagePicker/);
    assert.match(form, /<VehicleDocumentPicker/);
  }
  assert.doesNotMatch(source('components/vehicles/vehicle-image-picker.tsx'), /type="file"[\s\S]{0,200}required/);
  assert.doesNotMatch(source('components/vehicles/vehicle-document-picker.tsx'), /type="file"[\s\S]{0,200}required/);

  assert.match(clientForm, /year: vehicle\?\.year \? String\(vehicle\.year\) : ''/);
  assert.match(clientForm, /vinOrSerial: vehicle\?\.vinOrSerial \?\? ''/);
  assert.match(clientForm, /comment: vehicle\?\.comment \?\? ''/);
  assert.match(clientEdit, /vehicle=\{vehicle\}/);
  assert.match(crmEdit, /year: vehicle\.year \? String\(vehicle\.year\) : ''/);
  assert.match(crmEdit, /vinOrSerial: vehicle\.vinOrSerial \?\? ''/);
  assert.match(crmEdit, /comment: vehicle\.comment \?\? ''/);
  for (const editPage of [clientEdit, crmEdit]) {
    assert.match(editPage, /existingImageCount=\{vehicle\.images\.length\}/);
    assert.match(editPage, /existingDocumentCount=\{vehicle\.documents\.length\}/);
  }

  assert.match(workflow, /if \(input\.selection\.imageFiles\.length > 0\)/);
  assert.match(workflow, /if \(input\.selection\.documentFiles\.length > 0\)/);
  assert.match(clientActions, /excludeVehicleId: vehicle\.id/);
  assert.match(crmActions, /excludeVehicleId: vehicle\.id/);
  assert.match(crmActions, /requireCrmSession\(\)/);

  const vehicleModel = schema.match(/model Vehicle \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(vehicleModel, /year\s+Int\?/);
  assert.match(vehicleModel, /vinOrSerial\s+String\?/);
  assert.match(vehicleModel, /comment\s+String\?/);
  assert.doesNotMatch(vehicleModel, /vinOrSerial\s+String\?\s+@unique/);

  console.log('Vehicle create/edit required-field alignment checks passed.');
}

main();
