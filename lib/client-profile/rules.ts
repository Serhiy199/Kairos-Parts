import type { ClientType } from '@prisma/client';

import { normalizeUkrainianPhone } from '@/lib/phone/normalize';
import type {
  ClientProfileFieldErrors,
  ClientProfileUpdateInput
} from './validation';

export type ClientProfileUpdateSnapshot = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    normalizedPhone: string | null;
    authVersion: number;
  };
  profile: {
    id: string;
    clientType: ClientType;
    firstName: string | null;
    lastName: string | null;
    contactName: string | null;
    companyName: string | null;
    taxId: string | null;
    email: string | null;
    phone: string | null;
  };
  membership: {
    companyId: string;
    isPrimaryContact: boolean;
    company: { name: string; edrpou: string | null };
  } | null;
};

export type ClientProfileUpdatePlan = {
  identityChanged: boolean;
  emailChanged: boolean;
  phoneChanged: boolean;
  emailProfileSynchronized: boolean;
  phoneProfileSynchronized: boolean;
  identityAuditRequired: boolean;
  ordinaryChangedFields: string[];
  userData: {
    name: string;
    email: string;
    phone: string;
    normalizedPhone: string;
    authVersion?: { increment: 1 };
  };
  profileData: {
    firstName?: string;
    lastName?: string | null;
    contactName: string;
    companyName?: string;
    taxId?: string;
    email: string;
    phone: string;
  };
  companyData: { name: string; edrpou: string } | null;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
};

function normalizedEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function canonicalPhone(snapshot: ClientProfileUpdateSnapshot) {
  return normalizeUkrainianPhone(snapshot.user.normalizedPhone ?? snapshot.user.phone) ?? '';
}

function changed(before: string | null, after: string | null) {
  return (before ?? '') !== (after ?? '');
}

export function buildClientProfileUpdatePlan(
  snapshot: ClientProfileUpdateSnapshot,
  input: ClientProfileUpdateInput
): { ok: true; plan: ClientProfileUpdatePlan } | { ok: false; fieldErrors: ClientProfileFieldErrors } {
  if (snapshot.profile.clientType !== input.clientType) {
    return { ok: false, fieldErrors: { _form: 'Тип профілю змінився. Оновіть сторінку.' } };
  }

  const emailChanged = normalizedEmail(snapshot.user.email) !== input.email;
  const phoneChanged = canonicalPhone(snapshot) !== input.phone;
  const emailProfileSynchronized = snapshot.profile.email !== input.email;
  const phoneProfileSynchronized = snapshot.profile.phone !== input.phone;
  const identityChanged = emailChanged || phoneChanged;
  const identityAuditRequired = identityChanged || emailProfileSynchronized || phoneProfileSynchronized;
  const before: Record<string, string | null> = {};
  const after: Record<string, string | null> = {};
  const ordinaryChangedFields: string[] = [];
  let name: string;
  let profileData: ClientProfileUpdatePlan['profileData'];
  let companyData: ClientProfileUpdatePlan['companyData'] = null;

  if (input.clientType === 'INDIVIDUAL') {
    name = [input.firstName, input.lastName].filter(Boolean).join(' ');
    profileData = {
      firstName: input.firstName,
      lastName: input.lastName,
      contactName: name,
      email: input.email,
      phone: input.phone
    };

    for (const [field, oldValue, newValue, compatibilityValue] of [
      ['firstName', snapshot.profile.firstName, input.firstName],
      ['lastName', snapshot.profile.lastName, input.lastName],
      ['contactName', snapshot.profile.contactName, name, snapshot.user.name]
    ] as const) {
      if (changed(oldValue, newValue) || (compatibilityValue !== undefined && changed(compatibilityValue, newValue))) {
        ordinaryChangedFields.push(field);
        before[field] = changed(oldValue, newValue) ? oldValue : compatibilityValue ?? null;
        after[field] = newValue;
      }
    }
  } else {
    name = input.contactName;
    profileData = {
      contactName: input.contactName,
      email: input.email,
      phone: input.phone
    };

    if (changed(snapshot.profile.contactName, input.contactName) || changed(snapshot.user.name, input.contactName)) {
      ordinaryChangedFields.push('contactName');
      before.contactName = changed(snapshot.profile.contactName, input.contactName)
        ? snapshot.profile.contactName
        : snapshot.user.name;
      after.contactName = input.contactName;
    }

    if (!snapshot.membership) {
      profileData.companyName = input.companyName;
      profileData.taxId = input.taxId;
      for (const [field, oldValue, newValue] of [
        ['companyName', snapshot.profile.companyName, input.companyName],
        ['taxId', snapshot.profile.taxId, input.taxId]
      ] as const) {
        const profileValue = field === 'companyName' ? snapshot.profile.companyName : snapshot.profile.taxId;
        if (changed(oldValue, newValue) || changed(profileValue, newValue)) {
          ordinaryChangedFields.push(field);
          before[field] = changed(oldValue, newValue) ? oldValue : profileValue;
          after[field] = newValue;
        }
      }
    } else if (snapshot.membership.isPrimaryContact) {
      companyData = { name: input.companyName, edrpou: input.taxId };
      profileData.companyName = input.companyName;
      profileData.taxId = input.taxId;
      for (const [field, oldValue, newValue] of [
        ['companyName', snapshot.membership.company.name, input.companyName],
        ['taxId', snapshot.membership.company.edrpou, input.taxId]
      ] as const) {
        if (changed(oldValue, newValue)) {
          ordinaryChangedFields.push(field);
          before[field] = oldValue;
          after[field] = newValue;
        }
      }
    } else {
      const fieldErrors: ClientProfileFieldErrors = {};
      if (changed(snapshot.membership.company.name, input.companyName)) {
        fieldErrors.companyName = 'Лише основна контактна особа може змінити назву компанії.';
      }
      if (changed(snapshot.membership.company.edrpou, input.taxId)) {
        fieldErrors.taxId = 'Лише основна контактна особа може змінити ЄДРПОУ / ІПН.';
      }
      if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors };
      }
    }
  }

  return {
    ok: true,
    plan: {
      identityChanged,
      emailChanged,
      phoneChanged,
      emailProfileSynchronized,
      phoneProfileSynchronized,
      identityAuditRequired,
      ordinaryChangedFields,
      userData: {
        name,
        email: input.email,
        phone: input.phone,
        normalizedPhone: input.phone,
        ...(identityChanged ? { authVersion: { increment: 1 as const } } : {})
      },
      profileData,
      companyData,
      before,
      after
    }
  };
}

export function profileUpdateHasChanges(
  snapshot: ClientProfileUpdateSnapshot,
  plan: ClientProfileUpdatePlan
) {
  return plan.identityChanged
    || plan.ordinaryChangedFields.length > 0
    || snapshot.profile.email !== plan.profileData.email
    || snapshot.profile.phone !== plan.profileData.phone
    || (plan.profileData.companyName !== undefined && snapshot.profile.companyName !== plan.profileData.companyName)
    || (plan.profileData.taxId !== undefined && snapshot.profile.taxId !== plan.profileData.taxId)
    || snapshot.user.name !== plan.userData.name;
}
