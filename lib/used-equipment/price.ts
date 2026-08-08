export const USED_EQUIPMENT_PRICE_MAX = 2_147_483_647;

export type UsedEquipmentPriceParseResult =
  | { ok: true; value: number; normalized: string }
  | { ok: false; reason: 'required' | 'invalid' | 'out_of_range'; normalized: string };

const ALLOWED_PRICE_CHARACTERS = /^[0-9 \u00a0\u202f]+$/;
const ALLOWED_SPACE_SEPARATORS = /[ \u00a0\u202f]/g;
const priceNumberFormat = new Intl.NumberFormat('uk-UA', {
  useGrouping: true,
  maximumFractionDigits: 0
});

export function parseUsedEquipmentPrice(input: string): UsedEquipmentPriceParseResult {
  const normalized = input.replace(ALLOWED_SPACE_SEPARATORS, '');

  if (!normalized) {
    return { ok: false, reason: 'required', normalized };
  }

  if (!ALLOWED_PRICE_CHARACTERS.test(input)) {
    return { ok: false, reason: 'invalid', normalized };
  }

  const value = Number(normalized);

  if (!Number.isSafeInteger(value) || value < 1 || value > USED_EQUIPMENT_PRICE_MAX) {
    return { ok: false, reason: 'out_of_range', normalized };
  }

  return { ok: true, value, normalized };
}

export function formatUsedEquipmentPrice(priceAmount: number) {
  if (!Number.isInteger(priceAmount) || priceAmount < 1 || priceAmount > USED_EQUIPMENT_PRICE_MAX) {
    throw new RangeError('Used equipment price must be a positive PostgreSQL integer.');
  }

  const amount = priceNumberFormat.format(priceAmount).replace(/[\u00a0\u202f]/g, ' ');
  return `${amount} грн`;
}

export function formatUsedEquipmentPriceOrFallback(priceAmount: number | null, fallback = '—') {
  return priceAmount === null ? fallback : formatUsedEquipmentPrice(priceAmount);
}
