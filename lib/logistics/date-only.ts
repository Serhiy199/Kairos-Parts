export const LOGISTICS_BUSINESS_TIME_ZONE = 'Europe/Kyiv';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UKRAINIAN_MONTHS = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня'
] as const;

export type DateOnlyParseResult = {
  value: string;
  date: Date;
};

export function parseDateOnly(value: unknown): DateOnlyParseResult | null {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { value, date };
}

export function serializeDateOnly(date: Date | null): string | null {
  if (!date || !Number.isFinite(date.getTime())) return null;

  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const value = `${year}-${month}-${day}`;

  return parseDateOnly(value)?.value ?? null;
}

export function getKyivTodayDateOnly(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOGISTICS_BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const value = `${values.get('year') ?? ''}-${values.get('month') ?? ''}-${values.get('day') ?? ''}`;
  const parsed = parseDateOnly(value);

  if (!parsed) {
    throw new Error('Unable to resolve the current Europe/Kyiv calendar date.');
  }

  return parsed.value;
}

export function compareDateOnly(left: string, right: string): number {
  const parsedLeft = parseDateOnly(left);
  const parsedRight = parseDateOnly(right);
  if (!parsedLeft || !parsedRight) {
    throw new RangeError('Date-only comparison requires YYYY-MM-DD values.');
  }

  return parsedLeft.value.localeCompare(parsedRight.value);
}

function normalizedDateOnlyValue(value: string | Date | null) {
  if (typeof value === 'string') return parseDateOnly(value)?.value ?? null;
  return serializeDateOnly(value);
}

export function formatDateOnlyShort(value: string | Date | null): string {
  const normalized = normalizedDateOnlyValue(value);
  if (!normalized) return '';

  const [year, month, day] = normalized.split('-');
  return `${day}.${month}.${year}`;
}

export function formatDateOnlyLongUk(value: string | Date | null): string {
  const normalized = normalizedDateOnlyValue(value);
  if (!normalized) return '';

  const [year, month, day] = normalized.split('-').map(Number);
  return `${day} ${UKRAINIAN_MONTHS[month - 1]} ${year} року`;
}
