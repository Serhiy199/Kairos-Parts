import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  clientProfileIdentityChanged,
  clientProfileReadOnlyRows,
  editableClientProfileValues,
  type ClientProfilePresentation
} from '../lib/client-profile/presentation';

const root = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

function profile(overrides: Partial<ClientProfilePresentation> = {}): ClientProfilePresentation {
  return {
    clientType: 'INDIVIDUAL',
    firstName: 'Сергій',
    lastName: 'Городецький',
    companyName: '',
    taxId: '',
    contactName: 'Сергій Городецький',
    email: 'client@example.com',
    phone: '+380730031900',
    companyFieldsEditable: true,
    createdAtLabel: '10.08.2026',
    ...overrides
  };
}

function checkPresentationAndIdentityDetection() {
  const individual = profile();
  const individualLabels = clientProfileReadOnlyRows(individual).map((row) => row.label);
  assert.deepEqual(individualLabels, [
    'Тип клієнта',
    'Імʼя',
    'Прізвище',
    'Email',
    'Телефон',
    'Дата створення профілю'
  ]);
  assert.equal(individualLabels.includes('Контактна особа'), false);
  assert.equal(individualLabels.includes('Назва компанії'), false);

  const business = profile({
    clientType: 'BUSINESS',
    companyName: 'ТОВ «КАЙРОС ПАРТС»',
    taxId: '46387973',
    contactName: 'Сергій Городецький'
  });
  const businessLabels = clientProfileReadOnlyRows(business).map((row) => row.label);
  assert.deepEqual(businessLabels, [
    'Тип клієнта',
    'Назва компанії',
    'ЄДРПОУ / ІПН',
    'Контактна особа',
    'Email',
    'Телефон',
    'Дата створення профілю'
  ]);

  const initial = editableClientProfileValues(individual);
  assert.equal(clientProfileIdentityChanged(initial, initial), false);
  assert.equal(clientProfileIdentityChanged(initial, { ...initial, email: ' CLIENT@EXAMPLE.COM ' }), false);
  assert.equal(clientProfileIdentityChanged(initial, { ...initial, phone: '073 003 19 00' }), false);
  assert.equal(clientProfileIdentityChanged(initial, { ...initial, email: 'new@example.com' }), true);
  assert.equal(clientProfileIdentityChanged(initial, { ...initial, phone: '+380670000000' }), true);
}

function checkComponentContract() {
  const component = source('components/client/client-profile-editor.tsx');
  const page = source('app/client/profile/page.tsx');
  const actions = source('app/client/profile/actions.ts');
  const login = source('app/(auth)/login/page.tsx');

  assert.match(page, /export default async function ClientProfilePage/);
  assert.match(page, /<ClientProfileEditor/);
  assert.match(page, /companyFieldsEditable: access\.mode === 'PERSONAL' \|\| access\.isPrimaryContact/);
  assert.doesNotMatch(page, /passwordHash|authVersion|telegramChatId|telegramUserId/);

  assert.match(component, /profile\.clientType === 'INDIVIDUAL'/);
  assert.match(component, /name="firstName"/);
  assert.match(component, /name="lastName"/);
  assert.match(component, /name="companyName"/);
  assert.match(component, /name="taxId"/);
  assert.match(component, /name="contactName"/);
  assert.match(component, /readOnly=\{!profile\.companyFieldsEditable\}/);
  assert.match(component, /Ці дані може змінювати основна контактна особа компанії/);

  assert.match(component, /identityChanged \? \(/);
  assert.match(component, /name="currentPassword"/);
  assert.match(component, /type="password"/);
  assert.match(component, /autoComplete="current-password"/);
  assert.match(component, /if \(passwordRef\.current\) passwordRef\.current\.value = ''/);

  assert.match(component, /function cancelEditing\(\)[\s\S]*setValues\(initialValues\)[\s\S]*setFieldErrors\(\{\}\)[\s\S]*setEditing\(false\)/);
  assert.match(component, /type="button"[\s\S]*onClick=\{cancelEditing\}/);
  assert.match(component, /if \(!result\.ok\)[\s\S]*setFieldErrors\(result\.fieldErrors\)[\s\S]*return/);
  assert.match(component, /setFeedback\('Дані профілю оновлено\.'\)/);
  assert.match(component, /router\.refresh\(\)/);
  assert.match(component, /disabled=\{isPending\}/);
  assert.match(component, /Збереження\.\.\./);

  for (const accessibilityContract of [
    /<label/,
    /aria-invalid=/,
    /aria-describedby=/,
    /role="alert"/,
    /aria-live="polite"/,
    /focus-visible:ring-2/,
    /w-full/,
    /md:grid-cols-2/
  ]) {
    assert.match(component, accessibilityContract);
  }

  const submittedNames = [...component.matchAll(/name="([A-Za-z]+)"/g)]
    .map((match) => match[1])
    .filter((name) => name !== 'save');
  assert.deepEqual([...new Set(submittedNames)].sort(), [
    'companyName',
    'contactName',
    'currentPassword',
    'email',
    'firstName',
    'lastName',
    'phone',
    'taxId'
  ]);
  assert.doesNotMatch(component, /name="(?:userId|clientId|role|status|authVersion|clientType|companyId|isPrimaryContact)"/);

  assert.match(actions, /const result = await updateClientProfileAction\(formData\)/);
  assert.match(actions, /result\.ok && result\.requiresReauthentication/);
  assert.match(actions, /await signOut\(\{ redirectTo: '\/login\?profile-updated=1' \}\)/);
  assert.match(login, /params\['profile-updated'\] === '1'/);
  assert.match(login, /Дані оновлено\. Увійдіть з новою електронною адресою або номером телефону\./);
}

function checkMigrationAndProtectedScope() {
  const migrations = readdirSync(path.join(root, 'prisma/migrations'))
    .filter((name) => name.includes('client_profile_identity'));
  assert.deepEqual(migrations, ['20260809120000_add_client_profile_identity_constraints']);

  const service = source('lib/client-profile/service.ts');
  assert.doesNotMatch(service, /telegramUserId|telegramChatId/);
  assert.doesNotMatch(service, /\b(?:request|logisticsRequest|invoice)\.(?:update|delete|create)/);
}

checkPresentationAndIdentityDetection();
checkComponentContract();
checkMigrationAndProtectedScope();

console.log('Client profile editing Stage 2 focused UI checks passed.');
