import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

function between(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

const page = read('app/(public)/request/page.tsx');
const form = read('app/(public)/request/request-form.tsx');
const vehiclePage = read('app/client/vehicles/[id]/page.tsx');

const vehiclePrefill = between(page, 'async function prismaVehiclePrefill', 'async function prismaRepeatPrefill');
const repeatPrefill = page.slice(page.indexOf('async function prismaRepeatPrefill'));
const submitFlow = between(form, 'async function handleSubmit', "if (submitState.status === 'success')");

assert.match(vehiclePage, /href={`\/request\?source=client&vehicleId=\$\{vehicle\.id\}`}/);
assert.match(page, /vehicleId\?: string/);
assert.match(page, /const vehiclePrefill = params\.vehicleId \? await prismaVehiclePrefill\(clientAccess, params\.vehicleId\) : null/);

assert.match(vehiclePrefill, /where: \{ id: vehicleId, AND: \[vehicleAccessWhere\(access\)\] \}/);
assert.match(vehiclePrefill, /vehicleId: vehicle\.id/);
assert.match(vehiclePrefill, /equipmentType: vehicle\.type/);
assert.match(vehiclePrefill, /manufacturer: vehicle\.manufacturer/);
assert.match(vehiclePrefill, /model: vehicle\.model/);
assert.match(vehiclePrefill, /vehicleYear: vehicle\.year/);
assert.match(vehiclePrefill, /vinOrSerial: vehicle\.vinOrSerial \?\? ''/);
assert.match(vehiclePrefill, /description: ''/);
assert.match(vehiclePrefill, /comment: ''/);
assert.doesNotMatch(vehiclePrefill, /vehicle\.(?:comment|description|notes)/);

assert.match(repeatPrefill, /where: \{ id: requestId, AND: \[requestAccessWhere\(access\)\] \}/);
assert.match(repeatPrefill, /description: request\.description/);
assert.match(repeatPrefill, /comment: ''/);

assert.match(form, /name="description"[\s\S]{0,120}defaultValue=\{initialRequest\?\.description\}/);
assert.match(form, /name="comment"[\s\S]{0,120}defaultValue=\{initialRequest\?\.comment\}/);
assert.match(submitFlow, /if \(!response\.ok\) \{[\s\S]*?setSubmitState\([\s\S]*?return;[\s\S]*?\}[\s\S]*?form\.reset\(\)/);
assert.equal((submitFlow.match(/form\.reset\(\)/g) ?? []).length, 1);

console.log('Request vehicle-prefill checks passed.');
