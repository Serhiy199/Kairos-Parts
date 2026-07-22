const PHONE_INPUT_CHARACTERS = /^[+\d\s()-]*$/;
const MAX_LOCAL_DIGITS = 10;

export type FormattedPhoneInput = {
  canonical: string | null;
  display: string;
  isPhoneLike: boolean;
  localDigits: string;
};

export function isPhoneLikeIdentifier(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !PHONE_INPUT_CHARACTERS.test(trimmed)) {
    return false;
  }

  const digits = trimmed.replace(/\D/g, '');

  return (
    trimmed.startsWith('+')
    || (trimmed.startsWith('(') && digits.startsWith('0'))
    || digits.startsWith('0')
    || digits.startsWith('380')
  );
}

export function getLocalPhoneDigits(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+') && (digits === '3' || digits === '38')) {
    return '';
  }

  if (trimmed.startsWith('+') && digits.startsWith('38')) {
    return digits.slice(2, 2 + MAX_LOCAL_DIGITS);
  }

  if (digits.startsWith('380')) {
    return digits.slice(2, 2 + MAX_LOCAL_DIGITS);
  }

  return digits.slice(0, MAX_LOCAL_DIGITS);
}

export function formatLocalPhoneDigits(localDigits: string) {
  const digits = localDigits.replace(/\D/g, '').slice(0, MAX_LOCAL_DIGITS);

  if (!digits) {
    return '';
  }

  let display = `+38 (${digits.slice(0, 3)}`;

  if (digits.length >= 3) {
    display += ')';
  }
  if (digits.length > 3) {
    display += ` ${digits.slice(3, 6)}`;
  }
  if (digits.length > 6) {
    display += `-${digits.slice(6, 8)}`;
  }
  if (digits.length > 8) {
    display += `-${digits.slice(8, 10)}`;
  }

  return display;
}

export function formatPhoneIdentifierInput(value: string): FormattedPhoneInput {
  if (!isPhoneLikeIdentifier(value)) {
    return { canonical: null, display: value, isPhoneLike: false, localDigits: '' };
  }

  const localDigits = getLocalPhoneDigits(value);
  const display = localDigits ? formatLocalPhoneDigits(localDigits) : value;
  const canonical = localDigits.length === MAX_LOCAL_DIGITS && localDigits.startsWith('0')
    ? `+38${localDigits}`
    : null;

  return { canonical, display, isPhoneLike: true, localDigits };
}

export function getPhoneCaretPosition(display: string, localDigitCount: number) {
  if (localDigitCount <= 0) {
    return display.indexOf('(') >= 0 ? display.indexOf('(') + 1 : display.length;
  }

  let digitsToSkip = display.startsWith('+38') ? 2 : 0;
  let localDigitsSeen = 0;

  for (let index = 0; index < display.length; index += 1) {
    if (!/\d/.test(display[index])) {
      continue;
    }

    if (digitsToSkip > 0) {
      digitsToSkip -= 1;
      continue;
    }

    localDigitsSeen += 1;
    if (localDigitsSeen === localDigitCount) {
      return index + 1;
    }
  }

  return display.length;
}

export function getLocalDigitCountBeforeCaret(value: string, caret: number) {
  return getLocalPhoneDigits(value.slice(0, caret)).length;
}

export function removeMaskedPhoneDigit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: 'backward' | 'forward'
) {
  const parsed = formatPhoneIdentifierInput(value);
  if (!parsed.isPhoneLike || !parsed.localDigits) {
    return null;
  }

  const startCount = getLocalDigitCountBeforeCaret(value, selectionStart);
  const endCount = getLocalDigitCountBeforeCaret(value, selectionEnd);
  let deleteStart = startCount;
  let deleteEnd = endCount;

  if (selectionStart === selectionEnd) {
    if (direction === 'backward') {
      deleteStart = Math.max(0, startCount - 1);
      deleteEnd = startCount;
    } else {
      deleteStart = startCount;
      deleteEnd = Math.min(parsed.localDigits.length, startCount + 1);
    }
  }

  if (deleteStart === deleteEnd) {
    return null;
  }

  const localDigits = `${parsed.localDigits.slice(0, deleteStart)}${parsed.localDigits.slice(deleteEnd)}`;
  const display = formatLocalPhoneDigits(localDigits);

  return {
    caret: getPhoneCaretPosition(display, deleteStart),
    display
  };
}
