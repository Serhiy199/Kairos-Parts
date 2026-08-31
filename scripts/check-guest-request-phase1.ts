import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseRequestFormData } from '../lib/requests/validation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function validForm() {
  const form = new FormData();
  form.set('idempotencyKey', '123e4567-e89b-42d3-a456-426614174000');
  form.set('contactName', '  Іван   Іваненко  ');
  form.set('phone', '067 123 45 67');
  form.set('equipmentType', 'Трактор');
  form.set('manufacturer', 'John Deere');
  form.set('model', '8430');
  form.set('vehicleYear', '2018');
  form.set('vinOrSerial', 'VIN-123');
  form.set('description', 'Потрібен фільтр');
  return form;
}

function main() {
  const guest = parseRequestFormData(validForm(), { mode: 'GUEST' });
  assert.deepEqual(guest.errors, []);
  assert.equal(guest.data?.contactName, 'Іван Іваненко');
  assert.equal(guest.data?.phone, '+380671234567');
  assert.equal(guest.data?.email, null);
  assert.equal(guest.data?.companyName, null);
  assert.equal(guest.data?.vehicleId, undefined);

  const guestWithOptional = validForm();
  guestWithOptional.set('email', '  CLIENT@EXAMPLE.COM ');
  guestWithOptional.set('companyName', '  ТОВ   Тест ');
  const optional = parseRequestFormData(guestWithOptional, { mode: 'GUEST' });
  assert.equal(optional.data?.email, 'client@example.com');
  assert.equal(optional.data?.companyName, 'ТОВ Тест');

  const client = parseRequestFormData(validForm(), { mode: 'CLIENT' });
  assert.ok(client.errors.includes('Вкажіть назву компанії.'));
  assert.ok(client.errors.includes('Вкажіть email.'));

  const spoofed = validForm();
  spoofed.set('clientId', 'forged');
  assert.ok(parseRequestFormData(spoofed, { mode: 'GUEST' }).errors.some((error) => error.includes('недозволені')));
  const guestVehicle = validForm();
  guestVehicle.set('vehicleId', 'forged');
  assert.ok(parseRequestFormData(guestVehicle, { mode: 'GUEST' }).errors.some((error) => error.includes('недозволені')));
  const bot = validForm();
  bot.set('website', 'spam');
  assert.ok(parseRequestFormData(bot, { mode: 'GUEST' }).errors.length > 0);
  const badKey = validForm();
  badKey.set('idempotencyKey', 'not-a-uuid');
  assert.ok(parseRequestFormData(badKey, { mode: 'GUEST' }).errors.some((error) => error.includes('спробу надсилання')));

  const page = source('app/(public)/request/page.tsx');
  const form = source('app/(public)/request/request-form.tsx');
  const route = source('app/api/requests/route.ts');
  const service = source('lib/requests/create-request.ts');
  const security = source('lib/requests/request-security.ts');
  const upload = source('lib/files/request-file-upload-service.ts');
  const approval = source('lib/request-selection/send-for-approval.ts');
  const messages = source('lib/staff-telegram/messages.ts');
  const schema = source('prisma/schema.prisma');
  const migration = source('prisma/migrations/20260831180000_add_guest_request_creation/migration.sql');

  assert.match(page, /mode=\{isClient \? 'CLIENT' : 'GUEST'\}/);
  assert.doesNotMatch(page, /if \(!session\?\.user\?\.id \|\| session\.user\.role !== 'CLIENT'\)/);
  assert.match(form, /crypto\.randomUUID\(\)/);
  assert.match(form, /name="website"/);
  assert.match(form, /submitState\.publicStatusUrl \? \(/);
  assert.match(route, /assertPublicRequestOrigin\(request\)/);
  assert.match(route, /readBoundedPublicRequestFormData\(request\)/);
  assert.match(route, /consumeGuestRequestIpLimit\(request\)/);
  assert.match(route, /consumeGuestRequestPhoneLimit\(parsed\.data\.phone\)/);
  assert.match(route, /identity\.type === 'CLIENT'[\s\S]*publicStatusUrl/);
  assert.match(service, /source: input\.identity\.type === 'GUEST' \? 'WEBSITE' : 'CLIENT_DASHBOARD'/);
  assert.match(service, /guestName: input\.identity\.type === 'GUEST'/);
  assert.match(
    service,
    /companyName: input\.identity\.type === 'GUEST'\s*\? input\.parsed\.companyName/,
    'blank guest company must persist as null instead of falling back to contact name'
  );
  assert.match(service, /action: 'REQUEST_CREATED'/);
  assert.match(security, /INSERT INTO "AuthRateLimitBucket"/);
  assert.match(security, /totalBytes > MAX_REQUEST_MULTIPART_BYTES/);
  assert.match(security, /parts-request:phone/);
  assert.match(upload, /WEBSITE_GUEST/);
  assert.match(upload, /WEBSITE_FORM/);
  assert.match(upload, /auditAnonymousActor/);
  assert.match(upload, /RequestFileStorageAdapter/);
  assert.match(upload, /storage\.upload/);
  assert.match(service, /dependencies\.uploadFiles \?\? uploadRequestFilesForActor/);
  assert.match(service, /dependencies\.notifyManager \?\? notifyNewPartsRequest/);
  assert.match(service, /Request manager notification failed/);
  assert.match(messages, /input\.source === 'WEBSITE'/);
  assert.match(messages, /'Публічний сайт'/);
  assert.match(messages, /contactEmail/);
  assert.match(approval, /GUEST_REQUEST_APPROVAL_UNAVAILABLE/);
  assert.match(approval, /request\.clientId === null/);
  assert.match(schema, /idempotencyKey\s+String\?\s+@unique/);
  assert.match(schema, /enum RequestFileSource \{[\s\S]*WEBSITE_FORM/);
  assert.match(schema, /enum AuditAction \{[\s\S]*REQUEST_CREATED/);
  assert.match(migration, /ADD VALUE 'WEBSITE_FORM'/);
  assert.match(migration, /ADD VALUE 'REQUEST_CREATED'/);
  assert.match(migration, /ADD COLUMN "idempotencyKey" TEXT/);
  assert.doesNotMatch(migration, /DROP|DELETE|TRUNCATE/i);

  console.log('Guest request Phase 1 regression checks passed.');
}

main();
