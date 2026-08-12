import type { ClientType } from '@prisma/client';

import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_FIELDS = new Set([
  'firstName',
  'lastName',
  'companyName',
  'taxId',
  'contactName',
  'email',
  'phone',
  'currentPassword'
]);
const PROTECTED_FIELDS = new Set([
  'clientType',
  'role',
  'status',
  'authVersion',
  'userId',
  'clientId',
  'companyId',
  'isPrimaryContact'
]);

export type ClientProfileField =
  | 'firstName'
  | 'lastName'
  | 'companyName'
  | 'taxId'
  | 'contactName'
  | 'email'
  | 'phone'
  | 'currentPassword'
  | '_form';

export type ClientProfileFieldErrors = Partial<Record<ClientProfileField, string>>;

type InputSource = FormData | Record<string, unknown>;

type CommonProfileInput = {
  email: string;
  phone: string;
  currentPassword: string;
};

export type IndividualProfileInput = CommonProfileInput & {
  clientType: 'INDIVIDUAL';
  firstName: string;
  lastName: string | null;
};

export type BusinessProfileInput = CommonProfileInput & {
  clientType: 'BUSINESS';
  companyName: string;
  taxId: string;
  contactName: string;
};

export type ClientProfileUpdateInput = IndividualProfileInput | BusinessProfileInput;

export type ClientProfileValidationResult =
  | { ok: true; data: ClientProfileUpdateInput }
  | { ok: false; fieldErrors: ClientProfileFieldErrors };

function normalizeHumanText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function value(source: InputSource, key: string) {
  const raw = source instanceof FormData ? source.get(key) : source[key];
  return typeof raw === 'string' ? raw : '';
}

function keys(source: InputSource) {
  return source instanceof FormData ? [...source.keys()] : Object.keys(source);
}

function validateText(
  errors: ClientProfileFieldErrors,
  field: Exclude<ClientProfileField, 'email' | 'phone' | 'currentPassword' | '_form'>,
  text: string,
  options: { required: boolean; max: number }
) {
  if (options.required && !text) {
    errors[field] = 'Це поле є обовʼязковим.';
  } else if (text.length > options.max) {
    errors[field] = `Максимальна довжина — ${options.max} символів.`;
  }
}

export function validateClientProfileUpdateInput(
  source: InputSource,
  clientType: ClientType
): ClientProfileValidationResult {
  const fieldErrors: ClientProfileFieldErrors = {};
  const unexpected = keys(source).filter((key) => !key.startsWith('$ACTION_') && !ALLOWED_FIELDS.has(key));
  const protectedFields = unexpected.filter((key) => PROTECTED_FIELDS.has(key));

  if (protectedFields.length > 0) {
    fieldErrors._form = 'Запит містить захищені поля профілю.';
  } else if (unexpected.length > 0) {
    fieldErrors._form = 'Запит містить невідомі поля.';
  }

  const email = value(source, 'email').trim().toLowerCase();
  const rawPhone = value(source, 'phone');
  const phone = normalizeUkrainianPhone(rawPhone);
  const currentPassword = value(source, 'currentPassword');

  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'Некоректна електронна адреса.';
  }

  if (!phone) {
    fieldErrors.phone = 'Некоректний номер телефону.';
  }

  if (currentPassword.length > 128) {
    fieldErrors.currentPassword = 'Некоректний поточний пароль.';
  }

  if (clientType === 'INDIVIDUAL') {
    const firstName = normalizeHumanText(value(source, 'firstName'));
    const lastName = normalizeHumanText(value(source, 'lastName'));
    validateText(fieldErrors, 'firstName', firstName, { required: true, max: 120 });
    validateText(fieldErrors, 'lastName', lastName, { required: false, max: 120 });

    if (Object.keys(fieldErrors).length > 0 || !phone) {
      return { ok: false, fieldErrors };
    }

    return {
      ok: true,
      data: {
        clientType,
        firstName,
        lastName: lastName || null,
        email,
        phone,
        currentPassword
      }
    };
  }

  const companyName = normalizeHumanText(value(source, 'companyName'));
  const taxId = normalizeHumanText(value(source, 'taxId'));
  const contactName = normalizeHumanText(value(source, 'contactName'));
  validateText(fieldErrors, 'companyName', companyName, { required: true, max: 200 });
  validateText(fieldErrors, 'taxId', taxId, { required: true, max: 64 });
  validateText(fieldErrors, 'contactName', contactName, { required: true, max: 200 });

  if (Object.keys(fieldErrors).length > 0 || !phone) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      clientType,
      companyName,
      taxId,
      contactName,
      email,
      phone,
      currentPassword
    }
  };
}
