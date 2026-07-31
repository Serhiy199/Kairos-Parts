import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveDocumentSourceForActor } from '../lib/documents/source';
import {
  buildVehicleDisplayName,
  VehicleNameBuildError
} from '../lib/vehicles/name';
import {
  MAX_VEHICLE_DOCUMENTS,
  MAX_VEHICLE_DOCUMENT_TOTAL_BYTES,
  sanitizeVehicleDocumentName,
  validateVehicleDocumentFiles
} from '../lib/vehicles/documents';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function file(name: string, type: string, bytes: number[]) {
  return new File([Uint8Array.from(bytes)], name, { type });
}

async function main() {
  const canonical = buildVehicleDisplayName({
    manufacturer: '  John   Deere ',
    model: '  6155M  '
  });
  assert.deepEqual(canonical, {
    name: 'John Deere 6155M',
    manufacturer: 'John Deere',
    model: '6155M'
  });
  assert.throws(
    () => buildVehicleDisplayName({ manufacturer: ' ', model: '6155M' }),
    (error) => error instanceof VehicleNameBuildError
      && error.code === 'VEHICLE_MANUFACTURER_REQUIRED'
  );
  assert.throws(
    () => buildVehicleDisplayName({ manufacturer: 'John Deere', model: ' ' }),
    (error) => error instanceof VehicleNameBuildError
      && error.code === 'VEHICLE_MODEL_REQUIRED'
  );

  assert.equal(resolveDocumentSourceForActor('CLIENT'), 'CLIENT');
  assert.equal(resolveDocumentSourceForActor('MANAGER'), 'MANAGER');
  assert.equal(resolveDocumentSourceForActor('ADMIN'), 'ADMIN');
  assert.throws(() => resolveDocumentSourceForActor('GUEST'));

  const pdf = file('manual.pdf', 'application/pdf', [
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37
  ]);
  const jpeg = file('photo.jpeg', 'image/jpeg', [0xff, 0xd8, 0xff, 0xe0]);
  const png = file('photo.png', 'image/png', [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
  const webp = file('photo.webp', 'image/webp', [
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50
  ]);

  for (const validFile of [pdf, jpeg, png, webp]) {
    assert.equal((await validateVehicleDocumentFiles([validFile], 0)).ok, true);
  }

  const mismatch = await validateVehicleDocumentFiles([
    file('manual.exe', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d])
  ], 0);
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.ok ? null : mismatch.code, 'DOCUMENT_EXTENSION_MISMATCH');

  const doubleExtension = await validateVehicleDocumentFiles([
    file('manual.exe.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d])
  ], 0);
  assert.equal(doubleExtension.ok, false);
  assert.equal(
    doubleExtension.ok ? null : doubleExtension.code,
    'DOCUMENT_EXTENSION_MISMATCH'
  );

  const signatureMismatch = await validateVehicleDocumentFiles([
    file('manual.pdf', 'application/pdf', [0x4d, 0x5a, 0x90, 0x00])
  ], 0);
  assert.equal(signatureMismatch.ok, false);
  assert.equal(
    signatureMismatch.ok ? null : signatureMismatch.code,
    'DOCUMENT_SIGNATURE_INVALID'
  );

  const svg = await validateVehicleDocumentFiles([
    file('drawing.svg', 'image/svg+xml', [0x3c, 0x73, 0x76, 0x67])
  ], 0);
  assert.equal(svg.ok, false);
  assert.equal(svg.ok ? null : svg.code, 'DOCUMENT_TYPE_NOT_ALLOWED');

  const empty = await validateVehicleDocumentFiles([
    file('empty.pdf', 'application/pdf', [])
  ], 0);
  assert.equal(empty.ok, false);
  assert.equal(empty.ok ? null : empty.code, 'DOCUMENT_EMPTY');

  const countLimit = await validateVehicleDocumentFiles([pdf], MAX_VEHICLE_DOCUMENTS);
  assert.equal(countLimit.ok, false);
  assert.equal(
    countLimit.ok ? null : countLimit.code,
    'DOCUMENT_COUNT_LIMIT_REACHED'
  );
  assert.equal(MAX_VEHICLE_DOCUMENT_TOTAL_BYTES, 250 * 1024 * 1024);
  assert.equal(sanitizeVehicleDocumentName('../../manual.pdf'), 'manual.pdf');

  const schema = source('prisma/schema.prisma');
  assert.match(schema, /enum DocumentSource\s*\{[\s\S]*CLIENT[\s\S]*MANAGER[\s\S]*ADMIN[\s\S]*SYSTEM[\s\S]*LEGACY[\s\S]*\}/);
  assert.match(schema, /source\s+DocumentSource\s*\n/);
  assert.doesNotMatch(schema, /source\s+DocumentSource\s+@default/);
  assert.match(schema, /@@index\(\[vehicleId, source\]\)/);

  const migration = source(
    'prisma/migrations/20260730123000_add_document_source_provenance/migration.sql'
  );
  assert.match(migration, /CREATE TYPE "DocumentSource"/);
  assert.match(migration, /WHEN 'CLIENT'::"UserRole" THEN 'CLIENT'/);
  assert.match(migration, /WHEN 'MANAGER'::"UserRole" THEN 'MANAGER'/);
  assert.match(migration, /WHEN 'ADMIN'::"UserRole" THEN 'ADMIN'/);
  assert.match(migration, /SET "source" = 'LEGACY'/);
  assert.match(migration, /ALTER COLUMN "source" SET NOT NULL/);
  assert.doesNotMatch(migration, /SET DEFAULT/);

  const sourceResolver = source('lib/documents/source.ts');
  assert.match(sourceResolver, /resolveDocumentSourceForActor/);

  const documentService = source('lib/vehicles/document-service.ts');
  assert.match(documentService, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(documentService, /tx\.document\.aggregate/);
  assert.match(documentService, /MAX_VEHICLE_DOCUMENT_TOTAL_BYTES/);
  assert.match(documentService, /cleanupVehicleDocumentAssets/);
  assert.match(documentService, /visibleToClient = input\.actor\.role === 'CLIENT'/);
  assert.match(documentService, /source,\s*\n\s*uploadedById: input\.actor\.userId/);
  assert.match(documentService, /source: 'CLIENT',\s*\n\s*uploadedById: input\.actor\.userId/);
  assert.match(documentService, /DOCUMENT_ASSET_CLEANUP_FAILED/);

  const accessPolicy = source('lib/vehicles/document-access.ts');
  assert.match(accessPolicy, /vehicleAccessWhere\(access\)/);
  assert.match(accessPolicy, /\{ source: 'CLIENT' \}/);
  assert.match(accessPolicy, /\{ visibleToClient: true \}/);
  assert.match(accessPolicy, /document\.uploadedById === actor\.userId/);

  const clientVehicleApi = source('app/api/client/vehicles/[id]/route.ts');
  assert.doesNotMatch(clientVehicleApi, /documents:\s*true/);
  assert.doesNotMatch(clientVehicleApi, /storageKey:\s*true/);
  assert.match(clientVehicleApi, /source:\s*true/);

  const clientCreateApi = source('app/api/client/vehicles/route.ts');
  assert.match(clientCreateApi, /buildVehicleDisplayName/);
  assert.doesNotMatch(clientCreateApi, /validateVehicleName\(body\.name\)/);

  const clientActions = source('app/client/vehicles/actions.ts');
  const adminActions = source('app/admin/vehicles/actions.ts');
  const changeRequestApply = source('lib/change-requests/apply.ts');
  assert.match(clientActions, /buildVehicleDisplayName/);
  assert.match(adminActions, /buildVehicleDisplayName/);
  assert.match(changeRequestApply, /!field \|\| field === 'name'/);
  assert.match(changeRequestApply, /updateData\.name = canonicalName\.name/);

  const adminVehicleDocuments = source('app/admin/vehicles/document-actions.ts');
  const adminOwnerDocuments = source('app/admin/documents/actions.ts');
  const clientVehicleDocuments = source('app/client/vehicles/document-actions.ts');
  assert.match(adminVehicleDocuments, /createVehicleDocument/);
  assert.match(adminVehicleDocuments, /deleteVehicleDocument/);
  assert.match(adminOwnerDocuments, /resolveDocumentSourceForActor/);
  assert.match(adminOwnerDocuments, /source,/);
  assert.match(clientVehicleDocuments, /createVehicleDocument/);
  assert.match(clientVehicleDocuments, /deleteVehicleDocument/);

  const workflow = source('lib/vehicles/workflow.ts');
  assert.match(workflow, /CreateVehicleWithAssetsInput/);
  assert.match(workflow, /VehicleWorkflowActor/);
  assert.match(workflow, /VehicleWorkflowOwner/);

  console.log('Stage Client Vehicle Documents 2 backend foundation checks passed.');
}

void main();
