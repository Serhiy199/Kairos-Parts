import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getVehicleDocumentFiles,
  MAX_VEHICLE_DOCUMENT_BYTES,
  validateVehicleDocumentFiles
} from '../lib/vehicles/documents';
import {
  getVehicleImageFiles,
  MAX_VEHICLE_IMAGE_BYTES,
  validateVehicleImageFiles
} from '../lib/vehicles/images';
import {
  getNonEmptyUploadedFiles,
  isNonEmptyUploadedFile,
  normalizeUploadedFiles
} from '../lib/vehicles/upload-inputs';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function file(name: string, type: string, bytes: number[]) {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function pdf(name = 'manual.pdf') {
  return file(name, 'application/pdf', [
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37
  ]);
}

async function main() {
  const missing = new FormData();
  assert.deepEqual(getVehicleImageFiles(missing), []);
  assert.deepEqual(getVehicleDocumentFiles(missing), []);
  assert.deepEqual(normalizeUploadedFiles([]), []);
  assert.deepEqual(normalizeUploadedFiles([null, undefined, '', 'not-a-file']), []);

  const nativeBlobPlaceholder = new FormData();
  nativeBlobPlaceholder.append('documents', new Blob([], { type: 'application/pdf' }));
  const serializedBlob = nativeBlobPlaceholder.get('documents');
  assert.equal(serializedBlob instanceof File, true);
  if (serializedBlob instanceof File) {
    assert.equal(serializedBlob.size, 0);
    assert.equal(serializedBlob.name, 'blob');
  }
  assert.deepEqual(getVehicleDocumentFiles(nativeBlobPlaceholder), []);

  const emptyEntries = new FormData();
  emptyEntries.append('images', new File([], 'blob', { type: 'image/png' }));
  emptyEntries.append('images', new File([], '', { type: 'image/png' }));
  emptyEntries.append('images', new File([], '   ', { type: 'image/png' }));
  emptyEntries.append('images', 'not-a-file');
  emptyEntries.append('documents', new Blob([], { type: 'application/pdf' }));
  emptyEntries.append('documents', new File([], 'blob', { type: 'application/pdf' }));
  emptyEntries.append('documents', new File([], '', { type: 'application/pdf' }));
  emptyEntries.append('documents', 'not-a-file');

  assert.deepEqual(getNonEmptyUploadedFiles(emptyEntries, 'images'), []);
  assert.deepEqual(getVehicleImageFiles(emptyEntries), []);
  assert.deepEqual(getVehicleDocumentFiles(emptyEntries), []);
  assert.equal(
    getVehicleDocumentFiles(emptyEntries).some((entry) => entry.name === 'blob'),
    false
  );

  const realBlobNamedImage = file('blob', 'image/png', [1]);
  const realPhoto = file('tractor.png', 'image/png', [1, 2, 3]);
  const realDocument = pdf();
  assert.equal(isNonEmptyUploadedFile(realBlobNamedImage), true);
  assert.deepEqual(normalizeUploadedFiles([realBlobNamedImage]), [realBlobNamedImage]);

  const realEntries = new FormData();
  realEntries.append('images', realBlobNamedImage);
  realEntries.append('images', realPhoto);
  realEntries.append('documents', realDocument);
  assert.deepEqual(getVehicleImageFiles(realEntries), [realBlobNamedImage, realPhoto]);
  assert.deepEqual(getVehicleDocumentFiles(realEntries), [realDocument]);
  assert.equal(validateVehicleImageFiles(getVehicleImageFiles(realEntries), 0).ok, true);
  assert.equal((await validateVehicleDocumentFiles(getVehicleDocumentFiles(realEntries), 0)).ok, true);

  const invalidImageMime = file('tractor.gif', 'image/gif', [1]);
  const invalidImage = validateVehicleImageFiles([invalidImageMime], 0);
  assert.equal(invalidImage.ok, false);

  const oversizedImage = new File(
    [new Uint8Array(MAX_VEHICLE_IMAGE_BYTES + 1)],
    'tractor.png',
    { type: 'image/png' }
  );
  assert.equal(validateVehicleImageFiles([oversizedImage], 0).ok, false);

  const invalidDocumentMime = file('manual.txt', 'text/plain', [1]);
  const invalidDocument = await validateVehicleDocumentFiles([invalidDocumentMime], 0);
  assert.equal(invalidDocument.ok, false);
  assert.equal(invalidDocument.ok ? null : invalidDocument.code, 'DOCUMENT_TYPE_NOT_ALLOWED');

  const oversizedDocument = new File(
    [new Uint8Array(MAX_VEHICLE_DOCUMENT_BYTES + 1)],
    'manual.pdf',
    { type: 'application/pdf' }
  );
  const oversizedDocumentResult = await validateVehicleDocumentFiles([oversizedDocument], 0);
  assert.equal(oversizedDocumentResult.ok, false);
  assert.equal(oversizedDocumentResult.ok ? null : oversizedDocumentResult.code, 'DOCUMENT_TOO_LARGE');

  const workflow = source('lib/vehicles/asset-workflow.ts');
  const clientActions = source('app/client/vehicles/actions.ts');
  const crmActions = source('app/admin/vehicles/actions.ts');
  const clientForm = source('app/client/vehicles/vehicle-form.tsx');
  const crmForm = source('components/vehicles/admin-vehicle-form.tsx');
  const imagePicker = source('components/vehicles/vehicle-image-picker.tsx');
  const documentPicker = source('components/vehicles/vehicle-document-picker.tsx');
  const imageMutations = source('lib/vehicles/image-mutations.ts');
  const clientDocumentActions = source('app/client/vehicles/document-actions.ts');
  const crmDocumentActions = source('app/admin/vehicles/document-actions.ts');

  for (const actions of [clientActions, crmActions]) {
    assert.match(actions, /validateVehicleAssetSelection/);
    assert.match(actions, /attachVehicleAssets/);
  }
  for (const form of [clientForm, crmForm]) {
    assert.match(form, /<VehicleImagePicker/);
    assert.match(form, /<VehicleDocumentPicker/);
  }
  assert.match(imagePicker, /name="images"/);
  assert.match(imagePicker, /type="file"/);
  assert.match(imagePicker, /multiple/);
  assert.match(documentPicker, /name="documents"/);
  assert.match(documentPicker, /type="file"/);
  assert.match(documentPicker, /multiple/);
  assert.doesNotMatch(imagePicker, /new Blob|new File/);
  assert.doesNotMatch(documentPicker, /new Blob|new File/);

  assert.match(workflow, /if \(input\.selection\.imageFiles\.length > 0\)/);
  assert.match(workflow, /if \(input\.selection\.documentFiles\.length > 0\)/);
  assert.match(imageMutations, /getVehicleImageFiles\(formData\)/);
  assert.match(clientDocumentActions, /getVehicleDocumentFiles\(formData\)/);
  assert.match(crmDocumentActions, /getVehicleDocumentFiles\(formData\)/);

  console.log('Vehicle empty upload input normalization checks passed.');
}

void main();
