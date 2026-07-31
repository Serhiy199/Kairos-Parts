type BillingSnapshot = Record<string, unknown>;

type PartyDetailsOptions = {
  buyer?: boolean;
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

function part(label: string, value: string | null, options: { lowercaseLabel?: boolean } = {}) {
  if (!value) {
    return null;
  }

  return options.lowercaseLabel ? `${label} ${value}` : `${label}: ${value}`;
}

export function buildInvoiceBuyerTaxId(snapshot: unknown) {
  const data = snapshotObject(snapshot);
  const edrpou = stringField(data, 'edrpou');
  const ipn = stringField(data, 'ipn');

  return [edrpou, ipn].filter((value): value is string => Boolean(value)).join(' / ') || null;
}

export function buildInvoicePartyRows(snapshot: unknown, options: PartyDetailsOptions = {}) {
  const data = snapshotObject(snapshot);

  if (!data) {
    return null;
  }

  if (options.buyer) {
    const taxId = buildInvoiceBuyerTaxId(data);
    const rows: Array<[string, string | null]> = [
      ['Назва', stringField(data, 'legalName')]
    ];

    if (taxId) {
      rows.push(['ЄДРПОУ/ІПН', taxId]);
    }
    rows.push(
      ['МФО', stringField(data, 'mfo')],
      ['Контактна особа', stringField(data, 'contactPerson')],
      ['Телефон', stringField(data, 'phone')]
    );

    return rows;
  }

  return [
    ['Назва', stringField(data, 'legalName')],
    ['ЄДРПОУ', stringField(data, 'edrpou')],
    ['ІПН', stringField(data, 'ipn')],
    ['IBAN', stringField(data, 'iban')],
    ['Банк', stringField(data, 'bankName')],
    ['МФО', stringField(data, 'mfo')],
    ['Юридична адреса', stringField(data, 'legalAddress')],
    ['Контактна особа', stringField(data, 'contactPerson')],
    ['Телефон', stringField(data, 'phone')],
    ['Email', stringField(data, 'email')]
  ] satisfies Array<[string, string | null]>;
}

export function buildInvoicePartyDetails(snapshot: unknown, options: PartyDetailsOptions = {}) {
  const data = snapshotObject(snapshot);

  if (!data) {
    return null;
  }

  const parts = options.buyer
    ? [
        stringField(data, 'legalName'),
        part('ЄДРПОУ/ІПН', buildInvoiceBuyerTaxId(data), { lowercaseLabel: true }),
        part('МФО', stringField(data, 'mfo'), { lowercaseLabel: true }),
        part('контактна особа', stringField(data, 'contactPerson')),
        part('тел.', stringField(data, 'phone'), { lowercaseLabel: true })
      ]
    : [
        stringField(data, 'legalName'),
        part('ЄДРПОУ', stringField(data, 'edrpou'), { lowercaseLabel: true }),
        part('ІПН', stringField(data, 'ipn'), { lowercaseLabel: true }),
        part('IBAN', stringField(data, 'iban'), { lowercaseLabel: true }),
        part('банк', stringField(data, 'bankName'), { lowercaseLabel: true }),
        part('МФО', stringField(data, 'mfo'), { lowercaseLabel: true }),
        part('юридична адреса', stringField(data, 'legalAddress')),
        part('контактна особа', stringField(data, 'contactPerson')),
        part('тел.', stringField(data, 'phone'), { lowercaseLabel: true }),
        part('email', stringField(data, 'email'))
      ];
  const populatedParts = parts.filter((value): value is string => Boolean(value));

  return populatedParts.length ? populatedParts.join(', ') : null;
}
