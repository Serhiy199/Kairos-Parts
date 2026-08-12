import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { maskAuditLoginIdentifier } from '@/lib/audit-log/auth-event-policy';
import { hashPassword } from '@/lib/auth/password';
import { confirmProfileCurrentPassword } from '@/lib/client-profile/password';
import {
  buildClientProfileUpdatePlan,
  profileUpdateHasChanges,
  type ClientProfileUpdateSnapshot
} from '@/lib/client-profile/rules';
import {
  validateClientProfileUpdateInput,
  type BusinessProfileInput,
  type IndividualProfileInput
} from '@/lib/client-profile/validation';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function snapshot(overrides: Partial<ClientProfileUpdateSnapshot> = {}): ClientProfileUpdateSnapshot {
  return {
    user: {
      id: 'client-1',
      name: 'Сергій Городецький',
      email: 'client@example.test',
      phone: '+380730031900',
      normalizedPhone: '+380730031900',
      authVersion: 7
    },
    profile: {
      id: 'profile-1',
      clientType: 'INDIVIDUAL',
      firstName: 'Сергій',
      lastName: 'Городецький',
      contactName: 'Сергій Городецький',
      companyName: 'historical-company-value',
      taxId: 'historical-tax-value',
      email: 'client@example.test',
      phone: '+380730031900'
    },
    membership: null,
    ...overrides
  };
}

function individual(overrides: Partial<IndividualProfileInput> = {}): IndividualProfileInput {
  return {
    clientType: 'INDIVIDUAL',
    firstName: 'Сергій',
    lastName: 'Городецький',
    email: 'client@example.test',
    phone: '+380730031900',
    currentPassword: '',
    ...overrides
  };
}

function business(overrides: Partial<BusinessProfileInput> = {}): BusinessProfileInput {
  return {
    clientType: 'BUSINESS',
    companyName: 'Кайрос Тест',
    taxId: '12345678',
    contactName: 'Сергій Городецький',
    email: 'client@example.test',
    phone: '+380730031900',
    currentPassword: '',
    ...overrides
  };
}

async function main() {
  const validatedPerson = validateClientProfileUpdateInput({
    firstName: '  Сергій   Петрович ',
    lastName: '  Городецький ',
    email: ' CLIENT@Example.Test ',
    phone: '+38 (073) 003-19-00',
    currentPassword: ''
  }, 'INDIVIDUAL');
  assert.equal(validatedPerson.ok, true);
  if (validatedPerson.ok && validatedPerson.data.clientType === 'INDIVIDUAL') {
    assert.equal(validatedPerson.data.firstName, 'Сергій Петрович');
    assert.equal(validatedPerson.data.lastName, 'Городецький');
    assert.equal(validatedPerson.data.email, 'client@example.test');
    assert.equal(validatedPerson.data.phone, '+380730031900');
  }

  const protectedInput = validateClientProfileUpdateInput({
    firstName: 'Сергій',
    lastName: '',
    email: 'client@example.test',
    phone: '+380730031900',
    currentPassword: '',
    role: 'ADMIN',
    userId: 'another-user'
  }, 'INDIVIDUAL');
  assert.equal(protectedInput.ok, false);
  if (!protectedInput.ok) assert.ok(protectedInput.fieldErrors._form);

  for (const invalid of [
    { firstName: ' ', lastName: '', email: 'client@example.test', phone: '+380730031900', currentPassword: '' },
    { firstName: 'Сергій', lastName: '', email: 'invalid', phone: '+380730031900', currentPassword: '' },
    { firstName: 'Сергій', lastName: '', email: 'client@example.test', phone: '073003190', currentPassword: '' }
  ]) {
    assert.equal(validateClientProfileUpdateInput(invalid, 'INDIVIDUAL').ok, false);
  }

  const nameOnly = buildClientProfileUpdatePlan(snapshot(), individual({ firstName: 'Андрій' }));
  assert.equal(nameOnly.ok, true);
  if (nameOnly.ok) {
    assert.equal(nameOnly.plan.identityChanged, false);
    assert.equal(nameOnly.plan.userData.name, 'Андрій Городецький');
    assert.equal(nameOnly.plan.profileData.contactName, 'Андрій Городецький');
    assert.equal(nameOnly.plan.profileData.firstName, 'Андрій');
    assert.equal(nameOnly.plan.userData.authVersion, undefined);
    assert.equal(profileUpdateHasChanges(snapshot(), nameOnly.plan), true);
  }

  const emailChange = buildClientProfileUpdatePlan(
    snapshot(),
    individual({ email: 'NEW@EXAMPLE.TEST'.toLowerCase(), currentPassword: 'present' })
  );
  assert.equal(emailChange.ok, true);
  if (emailChange.ok) {
    assert.equal(emailChange.plan.emailChanged, true);
    assert.equal(emailChange.plan.phoneChanged, false);
    assert.deepEqual(emailChange.plan.userData.authVersion, { increment: 1 });
    assert.equal(emailChange.plan.userData.email, 'new@example.test');
    assert.equal(emailChange.plan.profileData.email, 'new@example.test');
  }

  const equivalentPhone = buildClientProfileUpdatePlan(
    snapshot(),
    individual({ phone: '+380730031900' })
  );
  assert.equal(equivalentPhone.ok, true);
  if (equivalentPhone.ok) assert.equal(equivalentPhone.plan.phoneChanged, false);

  const compatibilityRepair = buildClientProfileUpdatePlan(
    snapshot({ profile: { ...snapshot().profile, email: 'stale@example.test' } }),
    individual()
  );
  assert.equal(compatibilityRepair.ok, true);
  if (compatibilityRepair.ok) {
    assert.equal(compatibilityRepair.plan.identityChanged, false);
    assert.equal(compatibilityRepair.plan.emailProfileSynchronized, true);
    assert.equal(compatibilityRepair.plan.identityAuditRequired, true);
  }

  const bothIdentityFields = buildClientProfileUpdatePlan(
    snapshot(),
    individual({ email: 'new@example.test', phone: '+380680087708', currentPassword: 'present' })
  );
  assert.equal(bothIdentityFields.ok, true);
  if (bothIdentityFields.ok) {
    assert.equal(bothIdentityFields.plan.identityChanged, true);
    assert.equal(bothIdentityFields.plan.emailChanged, true);
    assert.equal(bothIdentityFields.plan.phoneChanged, true);
    assert.deepEqual(bothIdentityFields.plan.userData.authVersion, { increment: 1 });
    assert.equal(bothIdentityFields.plan.userData.phone, '+380680087708');
    assert.equal(bothIdentityFields.plan.userData.normalizedPhone, '+380680087708');
    assert.equal(bothIdentityFields.plan.profileData.phone, '+380680087708');
  }

  const businessProfile = snapshot({
    profile: {
      ...snapshot().profile,
      clientType: 'BUSINESS',
      companyName: 'Стара компанія',
      taxId: '11111111',
      contactName: 'Старий контакт'
    }
  });
  const withoutMembership = buildClientProfileUpdatePlan(
    businessProfile,
    business({ companyName: 'Нова компанія', taxId: '22222222', contactName: 'Новий контакт' })
  );
  assert.equal(withoutMembership.ok, true);
  if (withoutMembership.ok) {
    assert.equal(withoutMembership.plan.companyData, null);
    assert.equal(withoutMembership.plan.profileData.companyName, 'Нова компанія');
    assert.equal(withoutMembership.plan.profileData.taxId, '22222222');
    assert.equal(withoutMembership.plan.userData.name, 'Новий контакт');
  }

  const primarySnapshot = snapshot({
    profile: { ...businessProfile.profile },
    membership: {
      companyId: 'company-1',
      isPrimaryContact: true,
      company: { name: 'Спільна компанія', edrpou: '33333333' }
    }
  });
  const primaryUpdate = buildClientProfileUpdatePlan(
    primarySnapshot,
    business({ companyName: 'Оновлена компанія', taxId: '44444444' })
  );
  assert.equal(primaryUpdate.ok, true);
  if (primaryUpdate.ok) {
    assert.deepEqual(primaryUpdate.plan.companyData, { name: 'Оновлена компанія', edrpou: '44444444' });
    assert.equal(primaryUpdate.plan.profileData.companyName, 'Оновлена компанія');
  }

  const nonPrimarySnapshot = snapshot({
    profile: { ...businessProfile.profile },
    membership: {
      companyId: 'company-1',
      isPrimaryContact: false,
      company: { name: 'Спільна компанія', edrpou: '33333333' }
    }
  });
  const forbiddenSharedUpdate = buildClientProfileUpdatePlan(
    nonPrimarySnapshot,
    business({ companyName: 'Чужа зміна', taxId: '99999999' })
  );
  assert.equal(forbiddenSharedUpdate.ok, false);
  if (!forbiddenSharedUpdate.ok) {
    assert.ok(forbiddenSharedUpdate.fieldErrors.companyName);
    assert.ok(forbiddenSharedUpdate.fieldErrors.taxId);
  }
  const allowedContactUpdate = buildClientProfileUpdatePlan(
    nonPrimarySnapshot,
    business({ companyName: 'Спільна компанія', taxId: '33333333', contactName: 'Новий контакт' })
  );
  assert.equal(allowedContactUpdate.ok, true);
  if (allowedContactUpdate.ok) {
    assert.equal(allowedContactUpdate.plan.companyData, null);
    assert.equal(allowedContactUpdate.plan.userData.name, 'Новий контакт');
  }

  const passwordHash = await hashPassword('stage-profile-password');
  assert.equal(await confirmProfileCurrentPassword({ identityChanged: false, currentPassword: '', passwordHash }), 'not_required');
  assert.equal(await confirmProfileCurrentPassword({ identityChanged: true, currentPassword: '', passwordHash }), 'missing');
  assert.equal(await confirmProfileCurrentPassword({ identityChanged: true, currentPassword: 'wrong', passwordHash }), 'invalid');
  assert.equal(await confirmProfileCurrentPassword({ identityChanged: true, currentPassword: 'stage-profile-password', passwordHash }), 'confirmed');

  assert.equal(maskAuditLoginIdentifier('serhiy@example.com'), 's***@example.com');
  assert.equal(maskAuditLoginIdentifier('+380501234567'), '+380******567');

  const migration = source('prisma/migrations/20260809120000_add_client_profile_identity_constraints/migration.sql');
  assert.match(migration, /GROUP BY lower\("email"\)[\s\S]*HAVING COUNT\(\*\) > 1/);
  assert.match(migration, /CREATE UNIQUE INDEX "User_email_lower_key"[\s\S]*ON "User" \(lower\("email"\)\)[\s\S]*WHERE "email" IS NOT NULL/);
  assert.match(migration, /ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_IDENTITY_UPDATED'/);
  assert.doesNotMatch(migration, /UPDATE\s+"User"|DROP INDEX|ALTER COLUMN/i);

  const service = source('lib/client-profile/service.ts');
  assert.match(service, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(service, /await tx\.user\.update/);
  assert.match(service, /await tx\.clientProfile\.update/);
  assert.match(service, /await tx\.company\.update/);
  assert.match(service, /scope: 'IDENTIFIER'/);
  assert.doesNotMatch(service, /scope: 'IP'/);
  assert.match(service, /action: 'ENTITY_UPDATED'[\s\S]*category: 'STANDARD'/);
  assert.match(service, /action: 'ACCOUNT_IDENTITY_UPDATED'[\s\S]*category: 'LOGIN'/);
  assert.match(service, /maskAuditLoginIdentifier/);
  assert.match(service, /error\.code !== 'P2002'/);
  assert.match(service, /mode: 'insensitive'/);
  assert.match(service, /normalizeUkrainianPhone\(candidate\.normalizedPhone \?\? candidate\.phone\)/);
  assert.match(service, /assertCompanyIdentityAvailable/);
  assert.doesNotMatch(service, /tx\.(request|logisticsRequest|invoice|commercialOffer|notification)\.(update|updateMany|delete|deleteMany)/);
  assert.doesNotMatch(service, /telegramUserId|telegramChatId/);
  assert.doesNotMatch(service, /data:\s*\{[\s\S]*?\b(role|status|passwordHash)\b[\s\S]*?\}/);

  const action = source('app/client/profile/actions.ts');
  assert.match(action, /requireClientSession\(\)/);
  assert.match(action, /userId: session\.user\.id/);
  assert.doesNotMatch(action, /formData\.get\(['"](?:userId|clientId|role|status|authVersion)/);

  const middleware = source('middleware.ts');
  assert.match(middleware, /isSessionExpiredLogin/);
  assert.match(middleware, /searchParams\.get\('error'\) === 'session-expired'/);
  assert.match(middleware, /!isSessionExpiredLogin && pathname === '\/login'/);

  const preflight = source('scripts/preflight-client-profile-email-collisions.ts');
  assert.match(preflight, /CLIENT_PROFILE_EMAIL_AUDIT_CONFIRM_NON_PRODUCTION/);
  assert.match(preflight, /BEGIN READ ONLY/);
  assert.match(preflight, /GROUP BY lower\("email"\)/);
  assert.doesNotMatch(preflight, /config\(\{ path: '\.env\.local'/);

  console.log('Client profile editing Stage 1 focused checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Client profile editing Stage 1 checks failed.');
  process.exitCode = 1;
});
