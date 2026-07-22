export type AuditJsonValue = null | boolean | number | string | AuditJsonValue[] | { [key: string]: AuditJsonValue };
export type AuditJsonObject = { [key: string]: AuditJsonValue };

export const AUDIT_PAYLOAD_LIMITS = {
  maxDepth: 5,
  maxStringLength: 1000,
  maxArrayLength: 50,
  maxObjectKeys: 50,
  maxKeyLength: 128,
  maxTotalCharacters: 16_384
} as const;

const DENIED_KEY_PARTS = [
  'password',
  'token',
  'cookie',
  'authorization',
  'secret',
  'apikey',
  'telegrambottoken',
  'privateurl',
  'signedurl'
];

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isDeniedAuditKey(key: string) {
  const normalized = normalizedKey(key);
  return normalized === 'hash'
    || normalized.endsWith('hash')
    || DENIED_KEY_PARTS.some((part) => normalized.includes(part));
}

type Budget = { remaining: number };

function boundedString(value: string, budget: Budget) {
  if (budget.remaining <= 2) return undefined;
  const maxLength = Math.min(AUDIT_PAYLOAD_LIMITS.maxStringLength, budget.remaining - 2);
  const bounded = value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
    : value;
  budget.remaining -= bounded.length + 2;
  return bounded;
}

function boundedPrimitive<T extends null | boolean | number>(value: T, budget: Budget) {
  const size = value === null ? 4 : String(value).length;
  if (budget.remaining < size) return undefined;
  budget.remaining -= size;
  return value;
}

function decimalLikeValue(value: object) {
  const candidate = value as { constructor?: { name?: string }; toString?: () => string };
  if (candidate.constructor?.name !== 'Decimal' || typeof candidate.toString !== 'function') {
    return undefined;
  }

  try {
    return candidate.toString();
  } catch {
    return undefined;
  }
}

function sanitizeValue(
  value: unknown,
  depth: number,
  budget: Budget,
  ancestors: WeakSet<object>
): AuditJsonValue | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value === 'boolean') return boundedPrimitive(value, budget);
  if (typeof value === 'number') return Number.isFinite(value) ? boundedPrimitive(value, budget) : undefined;
  if (typeof value === 'bigint') return boundedString(value.toString(), budget);
  if (typeof value === 'string') return boundedString(value, budget);
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? boundedString(value.toISOString(), budget) : undefined;
  if (depth >= AUDIT_PAYLOAD_LIMITS.maxDepth || typeof value !== 'object') return undefined;

  const decimal = decimalLikeValue(value);
  if (decimal !== undefined) return boundedString(decimal, budget);
  if (ancestors.has(value)) return undefined;
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      budget.remaining -= 2;
      if (budget.remaining <= 0) return [];
      const result: AuditJsonValue[] = [];
      for (const entry of value.slice(0, AUDIT_PAYLOAD_LIMITS.maxArrayLength)) {
        budget.remaining -= 1;
        const sanitized = sanitizeValue(entry, depth + 1, budget, ancestors);
        if (sanitized !== undefined) result.push(sanitized);
        if (budget.remaining <= 0) break;
      }
      return result;
    }

    const result: AuditJsonObject = {};
    budget.remaining -= 2;
    if (budget.remaining <= 0) return result;
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.length <= AUDIT_PAYLOAD_LIMITS.maxKeyLength && !isDeniedAuditKey(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, AUDIT_PAYLOAD_LIMITS.maxObjectKeys);

    for (const [key, entry] of entries) {
      budget.remaining -= key.length + 4;
      if (budget.remaining <= 0) break;
      const sanitized = sanitizeValue(entry, depth + 1, budget, ancestors);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function sanitizeAuditPayload(payload: unknown, allowedFields: readonly string[]): AuditJsonObject | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;

  const source = payload as Record<string, unknown>;
  const budget: Budget = { remaining: AUDIT_PAYLOAD_LIMITS.maxTotalCharacters };
  const result: AuditJsonObject = {};
  const fields = [...new Set(allowedFields)]
    .filter((field) => !isDeniedAuditKey(field))
    .sort((left, right) => left.localeCompare(right));

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    budget.remaining -= field.length + 4;
    if (budget.remaining <= 0) break;
    const sanitized = sanitizeValue(source[field], 0, budget, new WeakSet());
    if (sanitized !== undefined) result[field] = sanitized;
  }

  return Object.keys(result).length ? result : undefined;
}

function jsonEqual(left: AuditJsonValue | undefined, right: AuditJsonValue | undefined) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildAuditDiff(before: unknown, after: unknown, allowedFields: readonly string[]) {
  const sanitizedBefore = sanitizeAuditPayload(before, allowedFields) ?? {};
  const sanitizedAfter = sanitizeAuditPayload(after, allowedFields) ?? {};
  const beforeDiff: AuditJsonObject = {};
  const afterDiff: AuditJsonObject = {};

  for (const field of [...new Set(allowedFields)].sort((left, right) => left.localeCompare(right))) {
    const beforeValue = sanitizedBefore[field];
    const afterValue = sanitizedAfter[field];
    if (jsonEqual(beforeValue, afterValue)) continue;
    if (beforeValue !== undefined) beforeDiff[field] = beforeValue;
    if (afterValue !== undefined) afterDiff[field] = afterValue;
  }

  return {
    before: Object.keys(beforeDiff).length ? beforeDiff : undefined,
    after: Object.keys(afterDiff).length ? afterDiff : undefined
  };
}
