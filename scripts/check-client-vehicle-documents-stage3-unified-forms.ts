import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildVehicleDisplayName } from '../lib/vehicles/name';
import {
  MAX_VEHICLE_DOCUMENT_BATCH_FILES,
  MAX_VEHICLE_DOCUMENT_BYTES,
  validateVehicleDocumentFiles
} from '../lib/vehicles/documents';
import { vehicleDocumentSourceLabel } from '../lib/vehicles/document-presentation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assertIncludes(value: string, expected: string, message: string) {
  assert.ok(value.includes(expected), message);
}

function assertExcludes(value: string, expected: string, message: string) {
  assert.ok(!value.includes(expected), message);
}

function pdf(name: string, size?: number) {
  const bytes = size
    ? new Uint8Array(size).fill(0x20)
    : new TextEncoder().encode('%PDF-1.7\n');
  bytes.set(new TextEncoder().encode('%PDF-'));
  return new File([bytes], name, { type: 'application/pdf' });
}

async function main() {
  const clientForm = source('app/client/vehicles/vehicle-form.tsx');
  const crmForm = source('components/vehicles/admin-vehicle-form.tsx');
  const coreFields = source('components/vehicles/vehicle-core-fields.tsx');
  const clientActions = source('app/client/vehicles/actions.ts');
  const crmActions = source('app/admin/vehicles/actions.ts');
  const clientDetail = source('app/client/vehicles/[id]/page.tsx');
  const clientDocuments = source('components/vehicles/client-vehicle-document-manager.tsx');
  const crmDocuments = source('components/vehicles/vehicle-document-manager.tsx');
  const workflow = source('lib/vehicles/asset-workflow.ts');
  const clientQuery = source('lib/vehicles/client-queries.ts');

  for (const form of [clientForm, crmForm, coreFields]) {
    assertExcludes(form, 'name="name"', 'У vehicle form не повинно бути ручного поля name.');
    assertExcludes(form, 'Назва техніки', 'У vehicle form не повинно бути label «Назва техніки».');
  }
  assertIncludes(clientForm, '<VehicleCoreFields', 'CLIENT form має використовувати shared core fields.');
  assertIncludes(crmForm, '<VehicleCoreFields', 'CRM form має використовувати shared core fields.');
  for (const form of [clientForm, crmForm]) {
    assertIncludes(form, '<VehicleImagePicker', 'Unified form має містити image picker.');
    assertIncludes(form, '<VehicleDocumentPicker', 'Unified form має містити document picker.');
    assert.equal((form.match(/type="submit"/g) ?? []).length, 1, 'Unified form має одну primary submit-кнопку.');
  }

  assertIncludes(clientActions, 'buildVehicleDisplayName', 'CLIENT action має генерувати canonical name.');
  assertIncludes(crmActions, 'buildVehicleDisplayName', 'CRM action має генерувати canonical name.');
  assertExcludes(clientActions, "formData.get('name')", 'CLIENT action не повинен довіряти name payload.');
  assertExcludes(crmActions, "formData.get('name')", 'CRM action не повинен довіряти name payload.');
  assert.equal(
    buildVehicleDisplayName({ manufacturer: 'John Deere', model: '6155M' }).name,
    'John Deere 6155M'
  );

  for (const actions of [clientActions, crmActions]) {
    assertIncludes(actions, 'validateVehicleAssetSelection', 'Assets мають пройти server preflight.');
    assertIncludes(actions, 'attachVehicleAssets', 'Assets мають додаватися через shared workflow.');
  }
  assertIncludes(workflow, 'createVehicleDocument', 'Shared workflow має використовувати document service.');
  assertIncludes(workflow, 'uploadVehicleImagesForActor', 'Shared workflow має використовувати image service.');
  assertIncludes(workflow, 'actor: input.actor', 'Actor має передаватися сервером.');
  assertExcludes(workflow, "formData.get('source')", 'Source не можна брати з browser payload.');
  assertExcludes(workflow, "formData.get('uploadedById')", 'uploadedById не можна брати з browser payload.');

  assertIncludes(clientDetail, '<VehicleForm', 'CLIENT edit має бути доступний на detail page.');
  assertIncludes(clientDetail, 'showUpload={false}', 'Existing asset managers не повинні дублювати upload forms.');
  assertIncludes(clientDetail, 'document.uploadedById === session.user.id', 'CLIENT delete UI має враховувати uploader.');
  assertIncludes(clientQuery, "{ source: 'CLIENT' }", 'CLIENT query має включати власні CLIENT documents.');
  assertIncludes(clientQuery, '{ visibleToClient: true }', 'CLIENT query має включати лише видимі staff documents.');
  assertIncludes(clientDocuments, 'document.canDelete', 'CLIENT delete control має бути server-derived.');
  assertIncludes(crmDocuments, "document.source !== 'CLIENT'", 'CRM не має показувати visibility toggle для CLIENT documents.');
  assertExcludes(clientDocuments, 'storageKey', 'Private storage metadata не можна рендерити.');
  assertExcludes(clientDocuments, 'publicId', 'Cloudinary public id не можна рендерити.');

  assert.equal(vehicleDocumentSourceLabel('CLIENT', 'CLIENT'), 'Додано вами');
  assert.equal(vehicleDocumentSourceLabel('LEGACY', 'CLIENT'), 'Документ техніки');
  assert.equal(vehicleDocumentSourceLabel('CLIENT', 'CRM'), 'Клієнт');
  assert.equal(vehicleDocumentSourceLabel('LEGACY', 'CRM'), 'Історичний документ');

  const tooMany = await validateVehicleDocumentFiles(
    Array.from({ length: MAX_VEHICLE_DOCUMENT_BATCH_FILES + 1 }, (_, index) => pdf(`doc-${index}.pdf`)),
    0
  );
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.equal(tooMany.code, 'DOCUMENT_BATCH_LIMIT_REACHED');

  const oversized = await validateVehicleDocumentFiles(
    [pdf('large.pdf', MAX_VEHICLE_DOCUMENT_BYTES + 1)],
    0
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.code, 'DOCUMENT_TOO_LARGE');

  const svg = await validateVehicleDocumentFiles(
    [new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })],
    0
  );
  assert.equal(svg.ok, false);
  if (!svg.ok) assert.equal(svg.code, 'DOCUMENT_TYPE_NOT_ALLOWED');

  const doubleExtension = await validateVehicleDocumentFiles([pdf('invoice.exe.pdf')], 0);
  assert.equal(doubleExtension.ok, false);
  if (!doubleExtension.ok) assert.equal(doubleExtension.code, 'DOCUMENT_EXTENSION_MISMATCH');

  console.log('Stage Client Vehicle Documents 3 focused checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
