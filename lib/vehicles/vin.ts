const WEAK_VIN_VALUES = new Set([
  '',
  '-',
  '—',
  '0',
  'N/A',
  'NA',
  'NONE',
  'NULL',
  'UNKNOWN',
  'NO VIN',
  'NOVIN',
  'НЕМАЄ',
  'НЕ ВКАЗАНО',
  'НЕВКАЗАНО',
  'БЕЗ VIN',
  'БЕЗVIN',
  'ВІДСУТНІЙ',
  'ВІДСУТНЄ'
]);

export function normalizeVehicleVin(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const upper = value.trim().toUpperCase();

  if (WEAK_VIN_VALUES.has(upper)) {
    return null;
  }

  const canonical = upper.replace(/[\s-]+/g, '');
  return WEAK_VIN_VALUES.has(canonical) ? null : canonical || null;
}

export function isWeakVehicleVin(value: string | null | undefined) {
  return Boolean(value?.trim()) && normalizeVehicleVin(value) === null;
}
