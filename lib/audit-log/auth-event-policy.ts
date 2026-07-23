export const AUTH_AUDIT_METADATA_FIELDS = [
  'event',
  'reason',
  'authMethod',
  'loginScope',
  'loginIdentifierMasked',
  'role',
  'source'
] as const;

export function maskAuditLoginIdentifier(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const at = normalized.indexOf('@');
  if (at > 0 && at < normalized.length - 1) {
    return `${normalized[0]}***${normalized.slice(at)}`;
  }

  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 7) {
    const prefix = normalized.startsWith('+') ? '+' : '';
    const visiblePrefixLength = Math.min(3, digits.length - 3);
    return `${prefix}${digits.slice(0, visiblePrefixLength)}${'*'.repeat(digits.length - visiblePrefixLength - 3)}${digits.slice(-3)}`;
  }

  return '***';
}
