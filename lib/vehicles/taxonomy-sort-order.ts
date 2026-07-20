export const TAXONOMY_SORT_ORDER_MIN = 0;
export const TAXONOMY_SORT_ORDER_MAX = 999;
export const TAXONOMY_SORT_ORDER_ERROR = 'Порядок має бути цілим числом від 0 до 999.';

export function parseTaxonomySortOrder(value: FormDataEntryValue | null) {
  if (value === null || typeof value !== 'string' || value.trim() === '') {
    return 0;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= TAXONOMY_SORT_ORDER_MIN && parsed <= TAXONOMY_SORT_ORDER_MAX
    ? parsed
    : null;
}
