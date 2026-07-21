const UKRAINIAN_PHONE_PATTERN = /^\+380\d{9}$/;
const ALLOWED_PHONE_INPUT_PATTERN = /^\+?[\d\s()-]+$/;

export function normalizeUkrainianPhone(phone: string | null | undefined) {
  const value = phone?.trim() ?? '';

  if (!value || !ALLOWED_PHONE_INPUT_PATTERN.test(value)) {
    return null;
  }

  const plusCount = (value.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !value.startsWith('+'))) {
    return null;
  }

  const compact = value.replace(/[\s()-]/g, '');
  let canonical: string;

  if (/^0\d{9}$/.test(compact)) {
    canonical = `+38${compact}`;
  } else if (/^380\d{9}$/.test(compact)) {
    canonical = `+${compact}`;
  } else {
    canonical = compact;
  }

  return UKRAINIAN_PHONE_PATTERN.test(canonical) ? canonical : null;
}

export function normalizePhoneDigits(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    return `38${digits}`;
  }

  if (digits.length === 9) {
    return `380${digits}`;
  }

  return digits;
}

export function getPhoneLookupTail(phone: string | null | undefined) {
  const normalized = normalizePhoneDigits(phone);
  return normalized.length >= 9 ? normalized.slice(-9) : normalized;
}

export function getPhoneDisplayVariants(phone: string | null | undefined) {
  const normalized = normalizePhoneDigits(phone);
  const variants = new Set<string>();

  if (phone?.trim()) {
    variants.add(phone.trim());
  }

  if (normalized) {
    variants.add(normalized);
    variants.add(`+${normalized}`);

    if (normalized.startsWith('380') && normalized.length === 12) {
      variants.add(`0${normalized.slice(3)}`);
    }
  }

  return [...variants];
}

export function phoneNumbersMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizePhoneDigits(left);
  const normalizedRight = normalizePhoneDigits(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftTail = getPhoneLookupTail(normalizedLeft);
  const rightTail = getPhoneLookupTail(normalizedRight);

  return Boolean(leftTail && rightTail && leftTail === rightTail);
}
