import type { AuditCategory } from '@/lib/audit-log/contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

function addUtcCalendarMonths(value: Date, months: number) {
  const sourceYear = value.getUTCFullYear();
  const sourceMonth = value.getUTCMonth();
  const targetMonthIndex = sourceMonth + months;
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(value.getUTCDate(), daysInTargetMonth);

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    value.getUTCHours(),
    value.getUTCMinutes(),
    value.getUTCSeconds(),
    value.getUTCMilliseconds()
  ));
}

export function getAuditExpiry(category: AuditCategory, createdAt: Date) {
  if (!Number.isFinite(createdAt.getTime())) {
    throw new Error('Audit createdAt must be a valid date.');
  }

  switch (category) {
    case 'TECHNICAL':
    case 'LOGIN':
    case 'CRITICAL_READ':
      return new Date(createdAt.getTime() + 30 * DAY_MS);
    case 'STANDARD':
      return new Date(createdAt.getTime() + 45 * DAY_MS);
    case 'FINANCIAL_CRITICAL':
      return addUtcCalendarMonths(createdAt, 4);
    default:
      throw new Error('Unsupported audit category.');
  }
}
