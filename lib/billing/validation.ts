import type { Prisma } from '@prisma/client';

export type SellerBillingInput = {
  legalName: string;
  edrpou?: string | null;
  ipn?: string | null;
  iban?: string | null;
  bankName?: string | null;
  mfo?: string | null;
  phone?: string | null;
  email?: string | null;
  legalAddress?: string | null;
};

export type CompanyBillingInput = {
  legalName: string;
  edrpou?: string | null;
  ipn?: string | null;
  iban?: string | null;
  bankName?: string | null;
  legalAddress?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  vatPayer: boolean;
};

export type SellerBillingSnapshot = SellerBillingInput;
export type BuyerBillingSnapshot = CompanyBillingInput;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optional(value: string) {
  return value || null;
}

function validateEmail(email: string, errors: string[]) {
  if (email && !emailPattern.test(email)) {
    errors.push('Вкажіть коректний email.');
  }
}

export function parseSellerBillingInput(formData: FormData): { ok: true; data: SellerBillingInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const legalName = readString(formData, 'legalName');
  const email = readString(formData, 'email');

  if (!legalName) {
    errors.push('Вкажіть назву компанії продавця.');
  }

  validateEmail(email, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      legalName,
      edrpou: optional(readString(formData, 'edrpou')),
      ipn: optional(readString(formData, 'ipn')),
      iban: optional(readString(formData, 'iban')),
      bankName: optional(readString(formData, 'bankName')),
      mfo: optional(readString(formData, 'mfo')),
      phone: optional(readString(formData, 'phone')),
      email: optional(email),
      legalAddress: optional(readString(formData, 'legalAddress'))
    }
  };
}

export function parseCompanyBillingInput(formData: FormData): { ok: true; data: CompanyBillingInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const legalName = readString(formData, 'legalName');
  const email = readString(formData, 'email');

  if (!legalName) {
    errors.push('Вкажіть юридичну назву покупця.');
  }

  validateEmail(email, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      legalName,
      edrpou: optional(readString(formData, 'edrpou')),
      ipn: optional(readString(formData, 'ipn')),
      iban: optional(readString(formData, 'iban')),
      bankName: optional(readString(formData, 'bankName')),
      legalAddress: optional(readString(formData, 'legalAddress')),
      contactPerson: optional(readString(formData, 'contactPerson')),
      phone: optional(readString(formData, 'phone')),
      email: optional(email),
      vatPayer: formData.get('vatPayer') === 'on'
    }
  };
}

export function sellerBillingSnapshot(data: SellerBillingInput): Prisma.InputJsonObject {
  return {
    legalName: data.legalName,
    edrpou: data.edrpou ?? null,
    ipn: data.ipn ?? null,
    iban: data.iban ?? null,
    bankName: data.bankName ?? null,
    mfo: data.mfo ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    legalAddress: data.legalAddress ?? null
  };
}

export function buyerBillingSnapshot(data: CompanyBillingInput): Prisma.InputJsonObject {
  return {
    legalName: data.legalName,
    edrpou: data.edrpou ?? null,
    ipn: data.ipn ?? null,
    iban: data.iban ?? null,
    bankName: data.bankName ?? null,
    legalAddress: data.legalAddress ?? null,
    contactPerson: data.contactPerson ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    vatPayer: data.vatPayer
  };
}
