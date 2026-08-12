import 'server-only';

import { Prisma } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { maskAuditLoginIdentifier } from '@/lib/audit-log/auth-event-policy';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import {
  canonicalizeRateLimitIdentifier,
  hmacRateLimitKey,
  requireRateLimitSecret
} from '@/lib/auth/rate-limit-core';
import { prisma } from '@/lib/prisma';
import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
import { confirmProfileCurrentPassword } from './password';
import {
  buildClientProfileUpdatePlan,
  profileUpdateHasChanges,
  type ClientProfileUpdateSnapshot
} from './rules';
import {
  validateClientProfileUpdateInput,
  type ClientProfileFieldErrors,
  type ClientProfileUpdateInput
} from './validation';

export type ClientProfileUpdateResult =
  | {
      ok: true;
      identityChanged: boolean;
      requiresReauthentication: boolean;
    }
  | {
      ok: false;
      fieldErrors: ClientProfileFieldErrors;
    };

type UpdateDatabase = Prisma.TransactionClient | typeof prisma;

type LoadedProfile = NonNullable<Awaited<ReturnType<typeof loadClientProfileUpdateState>>>;

class ProfileUpdateFailure extends Error {
  constructor(readonly fieldErrors: ClientProfileFieldErrors) {
    super('Client profile update rejected.');
    this.name = 'ProfileUpdateFailure';
  }
}

async function loadClientProfileUpdateState(db: UpdateDatabase, userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      normalizedPhone: true,
      passwordHash: true,
      role: true,
      status: true,
      authVersion: true,
      clientProfile: {
        select: {
          id: true,
          clientType: true,
          firstName: true,
          lastName: true,
          contactName: true,
          companyName: true,
          taxId: true,
          email: true,
          phone: true
        }
      },
      companyMemberships: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: {
          companyId: true,
          isPrimaryContact: true,
          company: { select: { name: true, edrpou: true } }
        }
      }
    }
  });
}

function activeClientSnapshot(state: LoadedProfile): ClientProfileUpdateSnapshot | null {
  if (state.role !== 'CLIENT' || state.status !== 'ACTIVE' || !state.clientProfile) {
    return null;
  }

  return {
    user: {
      id: state.id,
      name: state.name,
      email: state.email,
      phone: state.phone,
      normalizedPhone: state.normalizedPhone,
      authVersion: state.authVersion
    },
    profile: state.clientProfile,
    membership: state.companyMemberships[0] ?? null
  };
}

async function requireCurrentPassword(
  state: LoadedProfile,
  input: ClientProfileUpdateInput,
  identityChanged: boolean
) {
  const confirmation = await confirmProfileCurrentPassword({
    identityChanged,
    currentPassword: input.currentPassword,
    passwordHash: state.passwordHash
  });
  if (confirmation === 'missing') {
    throw new ProfileUpdateFailure({ currentPassword: 'Введіть поточний пароль.' });
  }
  if (confirmation === 'invalid') {
    throw new ProfileUpdateFailure({ currentPassword: 'Невірний поточний пароль.' });
  }
}

async function assertIdentityAvailable(
  tx: Prisma.TransactionClient,
  userId: string,
  input: ClientProfileUpdateInput,
  emailChanged: boolean,
  phoneChanged: boolean
) {
  if (emailChanged) {
    const emailOwner = await tx.user.findFirst({
      where: {
        id: { not: userId },
        email: { equals: input.email, mode: 'insensitive' }
      },
      select: { id: true }
    });
    if (emailOwner) {
      throw new ProfileUpdateFailure({ email: 'Ця електронна адреса вже використовується.' });
    }
  }

  if (phoneChanged) {
    const phoneCandidates = await tx.user.findMany({
      where: {
        id: { not: userId },
        OR: [{ normalizedPhone: { not: null } }, { phone: { not: null } }]
      },
      select: { phone: true, normalizedPhone: true }
    });
    const phoneOwnerExists = phoneCandidates.some((candidate) =>
      normalizeUkrainianPhone(candidate.normalizedPhone ?? candidate.phone) === input.phone
    );
    if (phoneOwnerExists) {
      throw new ProfileUpdateFailure({ phone: 'Цей номер телефону вже використовується.' });
    }
  }
}

async function assertCompanyIdentityAvailable(
  tx: Prisma.TransactionClient,
  companyId: string,
  companyData: { name: string; edrpou: string } | null
) {
  if (!companyData) return;
  const duplicate = await tx.company.findFirst({
    where: {
      id: { not: companyId },
      name: companyData.name,
      edrpou: companyData.edrpou
    },
    select: { id: true }
  });
  if (duplicate) {
    throw new ProfileUpdateFailure({
      companyName: 'Компанія з такими реквізитами вже існує.',
      taxId: 'Компанія з такими реквізитами вже існує.'
    });
  }
}

function identityRateLimitHashes(
  snapshot: ClientProfileUpdateSnapshot,
  input: ClientProfileUpdateInput,
  changes: { emailChanged: boolean; phoneChanged: boolean }
) {
  const identifiers = new Set<string>();
  if (changes.emailChanged) {
    if (snapshot.user.email) identifiers.add(snapshot.user.email);
    identifiers.add(input.email);
  }
  if (changes.phoneChanged) {
    const oldPhone = snapshot.user.normalizedPhone ?? snapshot.user.phone;
    if (oldPhone) identifiers.add(oldPhone);
    identifiers.add(input.phone);
  }
  if (identifiers.size === 0) return [];

  const secret = requireRateLimitSecret();
  return [...identifiers].map((identifier) =>
    hmacRateLimitKey(secret, 'identifier', canonicalizeRateLimitIdentifier(identifier))
  );
}

function identityAuditValues(
  snapshot: ClientProfileUpdateSnapshot,
  input: ClientProfileUpdateInput,
  changes: {
    emailChanged: boolean;
    phoneChanged: boolean;
    emailProfileSynchronized: boolean;
    phoneProfileSynchronized: boolean;
  }
) {
  const before: Record<string, string | null> = {};
  const after: Record<string, string | null> = {};
  if (changes.emailChanged || changes.emailProfileSynchronized) {
    before.email = maskAuditLoginIdentifier(
      changes.emailChanged ? snapshot.user.email : snapshot.profile.email
    );
    after.email = maskAuditLoginIdentifier(input.email);
  }
  if (changes.phoneChanged || changes.phoneProfileSynchronized) {
    before.phone = maskAuditLoginIdentifier(
      changes.phoneChanged
        ? snapshot.user.normalizedPhone ?? snapshot.user.phone
        : snapshot.profile.phone
    );
    after.phone = maskAuditLoginIdentifier(input.phone);
  }
  return { before, after };
}

function mapDatabaseError(error: unknown): ClientProfileUpdateResult | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (error.code === 'P2034') {
    return { ok: false, fieldErrors: { _form: 'Профіль змінився одночасно. Спробуйте ще раз.' } };
  }
  if (error.code !== 'P2002') return null;

  const target = JSON.stringify(error.meta?.target ?? '').toLowerCase();
  if (target.includes('email') || target.includes('user_email_lower_key')) {
    return { ok: false, fieldErrors: { email: 'Ця електронна адреса вже використовується.' } };
  }
  if (target.includes('phone')) {
    return { ok: false, fieldErrors: { phone: 'Цей номер телефону вже використовується.' } };
  }
  if (target.includes('company') || target.includes('name') || target.includes('edrpou')) {
    return {
      ok: false,
      fieldErrors: {
        companyName: 'Компанія з такими реквізитами вже існує.',
        taxId: 'Компанія з такими реквізитами вже існує.'
      }
    };
  }
  return { ok: false, fieldErrors: { _form: 'Ці дані вже використовуються.' } };
}

export async function updateOwnClientProfile(input: {
  userId: string;
  formData: FormData;
  requestContext?: AuditRequestContext;
}): Promise<ClientProfileUpdateResult> {
  const initialState = await loadClientProfileUpdateState(prisma, input.userId);
  if (!initialState) {
    return { ok: false, fieldErrors: { _form: 'Профіль клієнта не знайдено.' } };
  }
  const initialSnapshot = activeClientSnapshot(initialState);
  if (!initialSnapshot) {
    return { ok: false, fieldErrors: { _form: 'Оновлення профілю недоступне.' } };
  }

  const initialValidation = validateClientProfileUpdateInput(
    input.formData,
    initialSnapshot.profile.clientType
  );
  if (!initialValidation.ok) return initialValidation;

  const initialPlan = buildClientProfileUpdatePlan(initialSnapshot, initialValidation.data);
  if (!initialPlan.ok) return initialPlan;

  try {
    await requireCurrentPassword(initialState, initialValidation.data, initialPlan.plan.identityChanged);

    if (!profileUpdateHasChanges(initialSnapshot, initialPlan.plan)) {
      return { ok: true, identityChanged: false, requiresReauthentication: false };
    }

    return await prisma.$transaction(async (tx) => {
      const state = await loadClientProfileUpdateState(tx, input.userId);
      if (!state) throw new ProfileUpdateFailure({ _form: 'Профіль клієнта не знайдено.' });
      const snapshot = activeClientSnapshot(state);
      if (!snapshot) throw new ProfileUpdateFailure({ _form: 'Оновлення профілю недоступне.' });

      const validation = validateClientProfileUpdateInput(input.formData, snapshot.profile.clientType);
      if (!validation.ok) throw new ProfileUpdateFailure(validation.fieldErrors);
      const planned = buildClientProfileUpdatePlan(snapshot, validation.data);
      if (!planned.ok) throw new ProfileUpdateFailure(planned.fieldErrors);
      const plan = planned.plan;

      await requireCurrentPassword(state, validation.data, plan.identityChanged);
      await assertIdentityAvailable(
        tx,
        input.userId,
        validation.data,
        plan.emailChanged,
        plan.phoneChanged
      );
      await assertCompanyIdentityAvailable(
        tx,
        snapshot.membership?.companyId ?? '',
        plan.companyData
      );

      if (!profileUpdateHasChanges(snapshot, plan)) {
        return { ok: true, identityChanged: false, requiresReauthentication: false };
      }

      await tx.user.update({ where: { id: input.userId }, data: plan.userData });
      await tx.clientProfile.update({ where: { id: snapshot.profile.id }, data: plan.profileData });

      if (plan.companyData && snapshot.membership) {
        await tx.company.update({
          where: { id: snapshot.membership.companyId },
          data: plan.companyData
        });
      }

      const rateLimitHashes = identityRateLimitHashes(snapshot, validation.data, plan);
      if (rateLimitHashes.length > 0) {
        await tx.authRateLimitBucket.deleteMany({
          where: { scope: 'IDENTIFIER', keyHash: { in: rateLimitHashes } }
        });
      }

      if (plan.ordinaryChangedFields.length > 0) {
        await writeAuditLog(tx, {
          actor: auditUserActor(input.userId),
          companyId: snapshot.membership?.companyId,
          entityType: 'CLIENT',
          entityId: snapshot.profile.id,
          entityLabel: plan.userData.name,
          action: 'ENTITY_UPDATED',
          category: 'STANDARD',
          oldValue: plan.before,
          newValue: plan.after,
          metadata: { source: 'CLIENT_CABINET' },
          allowedFields: {
            oldValue: plan.ordinaryChangedFields,
            newValue: plan.ordinaryChangedFields,
            metadata: ['source']
          },
          requestContext: input.requestContext
        });
      }

      if (plan.identityAuditRequired) {
        const audit = identityAuditValues(snapshot, validation.data, plan);
        await writeAuditLog(tx, {
          actor: auditUserActor(input.userId),
          entityType: 'USER',
          entityId: input.userId,
          entityLabel: plan.userData.name,
          action: 'ACCOUNT_IDENTITY_UPDATED',
          category: 'LOGIN',
          oldValue: audit.before,
          newValue: audit.after,
          metadata: {
            source: 'CLIENT_CABINET',
            emailChanged: plan.emailChanged,
            phoneChanged: plan.phoneChanged,
            emailProfileSynchronized: plan.emailProfileSynchronized,
            phoneProfileSynchronized: plan.phoneProfileSynchronized
          },
          allowedFields: {
            oldValue: ['email', 'phone'],
            newValue: ['email', 'phone'],
            metadata: [
              'source',
              'emailChanged',
              'phoneChanged',
              'emailProfileSynchronized',
              'phoneProfileSynchronized'
            ]
          },
          requestContext: input.requestContext
        });
      }

      return {
        ok: true,
        identityChanged: plan.identityChanged,
        requiresReauthentication: plan.identityChanged
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof ProfileUpdateFailure) {
      return { ok: false, fieldErrors: error.fieldErrors };
    }
    const databaseResult = mapDatabaseError(error);
    if (databaseResult) return databaseResult;
    throw error;
  }
}
