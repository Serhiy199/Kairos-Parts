export type RequestItemInput = {
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  quantity: number;
  unit: string;
  supplierName: string | null;
  availability: string | null;
  purchasePrice: string | null;
  salePrice: string | null;
  currency: string;
  comment: string | null;
  visibleToClient: boolean;
};

export type RequestItemValidationResult =
  | { ok: true; data: RequestItemInput }
  | { ok: false; error: string };

type InputSource = FormData | Record<string, unknown>;

function readValue(source: InputSource, key: string) {
  if (source instanceof FormData) {
    const value = source.get(key);
    return typeof value === 'string' ? value : '';
  }

  const value = source[key];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

function optionalText(source: InputSource, key: string) {
  const value = readValue(source, key).trim();
  return value || null;
}

function requiredText(source: InputSource, key: string) {
  return readValue(source, key).trim();
}

function normalizeDecimal(source: InputSource, key: string) {
  const raw = readValue(source, key).trim().replace(',', '.');

  if (!raw) {
    return { ok: true as const, value: null };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false as const, error: 'Ціна має бути числом більше або дорівнювати 0.' };
  }

  return { ok: true as const, value: raw };
}

function readBoolean(source: InputSource, key: string) {
  if (source instanceof FormData) {
    return source.get(key) === 'on' || source.get(key) === 'true';
  }

  return source[key] === true || source[key] === 'true' || source[key] === 'on';
}

export function parseRequestItemInput(source: InputSource): RequestItemValidationResult {
  const name = requiredText(source, 'name');

  if (!name) {
    return { ok: false, error: 'Назва запчастини є обовʼязковою.' };
  }

  const quantityRaw = readValue(source, 'quantity').trim();
  const quantity = quantityRaw ? Number(quantityRaw) : 1;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'Кількість має бути цілим числом від 1.' };
  }

  const purchasePrice = normalizeDecimal(source, 'purchasePrice');
  const salePrice = normalizeDecimal(source, 'salePrice');

  if (!purchasePrice.ok) {
    return { ok: false, error: purchasePrice.error };
  }

  if (!salePrice.ok) {
    return { ok: false, error: salePrice.error };
  }

  return {
    ok: true,
    data: {
      name,
      brand: optionalText(source, 'brand'),
      catalogNumber: optionalText(source, 'catalogNumber'),
      quantity,
      unit: optionalText(source, 'unit') ?? 'шт',
      supplierName: optionalText(source, 'supplierName'),
      availability: optionalText(source, 'availability'),
      purchasePrice: purchasePrice.value,
      salePrice: salePrice.value,
      currency: optionalText(source, 'currency') ?? 'UAH',
      comment: optionalText(source, 'comment'),
      visibleToClient: readBoolean(source, 'visibleToClient')
    }
  };
}
