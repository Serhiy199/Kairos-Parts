import { EQUIPMENT_TEXT_FIELD_MAX_LENGTH } from '@/lib/features/equipment-taxonomy';

export type RequestItemInput = {
  equipmentType: string | null;
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

export type RequestItemUpdateValues = Pick<
  RequestItemInput,
  | 'equipmentType'
  | 'name'
  | 'brand'
  | 'catalogNumber'
  | 'quantity'
  | 'unit'
  | 'availability'
  | 'salePrice'
  | 'currency'
  | 'comment'
>;

export type RequestItemUpdateValidationResult =
  | { ok: true; data: RequestItemUpdateValues }
  | { ok: false; error: string };

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

function hasDuplicateFormField(source: InputSource, key: string) {
  return source instanceof FormData && source.getAll(key).length > 1;
}

export function parseRequestItemInput(source: InputSource): RequestItemValidationResult {
  const equipmentType = optionalText(source, 'equipmentType');
  const brand = optionalText(source, 'brand');
  const name = requiredText(source, 'name');

  if (!brand) {
    return { ok: false, error: 'Виробник є обов’язковим.' };
  }

  if ((equipmentType?.length ?? 0) > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    return { ok: false, error: `Тип техніки має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.` };
  }

  if ((brand?.length ?? 0) > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    return { ok: false, error: `Виробник має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.` };
  }

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
      equipmentType,
      name,
      brand,
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

export function parseRequestItemUpdateInput(
  source: InputSource
): RequestItemUpdateValidationResult {
  const editableFields = [
    'equipmentType',
    'name',
    'brand',
    'catalogNumber',
    'quantity',
    'unit',
    'availability',
    'salePrice',
    'currency',
    'comment'
  ] as const;

  if (editableFields.some((field) => hasDuplicateFormField(source, field))) {
    return { ok: false, error: 'Форма містить дубльовані поля позиції.' };
  }

  const equipmentType = optionalText(source, 'equipmentType');
  const brand = optionalText(source, 'brand');
  const name = requiredText(source, 'name');

  if (!brand) {
    return { ok: false, error: 'Виробник є обов’язковим.' };
  }

  if ((equipmentType?.length ?? 0) > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    return { ok: false, error: `Тип техніки має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.` };
  }
  if ((brand?.length ?? 0) > EQUIPMENT_TEXT_FIELD_MAX_LENGTH) {
    return { ok: false, error: `Виробник має бути не довшим за ${EQUIPMENT_TEXT_FIELD_MAX_LENGTH} символів.` };
  }
  if (!name) {
    return { ok: false, error: 'Назва запчастини є обовʼязковою.' };
  }

  const quantityRaw = readValue(source, 'quantity').trim();
  if (!/^[1-9]\d*$/.test(quantityRaw)) {
    return { ok: false, error: 'Кількість має бути цілим числом від 1.' };
  }
  const quantity = Number(quantityRaw);
  if (!Number.isSafeInteger(quantity)) {
    return { ok: false, error: 'Кількість має бути цілим числом від 1.' };
  }

  const salePrice = normalizeDecimal(source, 'salePrice');
  if (!salePrice.ok) {
    return { ok: false, error: salePrice.error };
  }

  return {
    ok: true,
    data: {
      equipmentType,
      name,
      brand,
      catalogNumber: optionalText(source, 'catalogNumber'),
      quantity,
      unit: optionalText(source, 'unit') ?? 'шт',
      availability: optionalText(source, 'availability'),
      salePrice: salePrice.value,
      currency: optionalText(source, 'currency') ?? 'UAH',
      comment: optionalText(source, 'comment')
    }
  };
}
