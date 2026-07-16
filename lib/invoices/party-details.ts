type BillingSnapshot = Record<string, unknown>;

type PartyDetailsOptions = {
  includeVatPayer?: boolean;
};

function snapshotObject(snapshot: unknown): BillingSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as BillingSnapshot;
}

function stringField(snapshot: BillingSnapshot | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanField(snapshot: BillingSnapshot | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'boolean' ? (value ? 'Так' : 'Ні') : null;
}

function part(label: string, value: string | null, options: { lowercaseLabel?: boolean } = {}) {
  if (!value) {
    return null;
  }

  return options.lowercaseLabel ? `${label} ${value}` : `${label}: ${value}`;
}

export function buildInvoicePartyDetails(snapshot: unknown, options: PartyDetailsOptions = {}) {
  const data = snapshotObject(snapshot);

  if (!data) {
    return null;
  }

  const parts = [
    stringField(data, 'legalName'),
    part('ЄДРПОУ', stringField(data, 'edrpou'), { lowercaseLabel: true }),
    part('ІПН', stringField(data, 'ipn'), { lowercaseLabel: true }),
    part('IBAN', stringField(data, 'iban'), { lowercaseLabel: true }),
    part('банк', stringField(data, 'bankName'), { lowercaseLabel: true }),
    part('МФО', stringField(data, 'mfo'), { lowercaseLabel: true }),
    part('юридична адреса', stringField(data, 'legalAddress')),
    part('контактна особа', stringField(data, 'contactPerson')),
    part('тел.', stringField(data, 'phone'), { lowercaseLabel: true }),
    part('email', stringField(data, 'email')),
    options.includeVatPayer ? part('платник ПДВ', booleanField(data, 'vatPayer')) : null
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(', ') : null;
}
