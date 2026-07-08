export type CompanyInput = {
  name: string;
  edrpou: string | null;
  phone: string | null;
  email: string | null;
  legalAddress: string | null;
};

type InputSource = FormData | Record<string, unknown>;

function readValue(source: InputSource, key: string) {
  if (source instanceof FormData) {
    const value = source.get(key);
    return typeof value === 'string' ? value.trim() : '';
  }

  const value = source[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function optionalText(source: InputSource, key: string) {
  const value = readValue(source, key);
  return value || null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseCompanyInput(source: InputSource) {
  const name = readValue(source, 'name');
  const email = optionalText(source, 'email');

  if (!name) {
    return { ok: false as const, error: 'Назва компанії є обовʼязковою.' };
  }

  if (email && !isValidEmail(email)) {
    return { ok: false as const, error: 'Email компанії має бути коректним.' };
  }

  return {
    ok: true as const,
    data: {
      name,
      edrpou: optionalText(source, 'edrpou'),
      phone: optionalText(source, 'phone'),
      email,
      legalAddress: optionalText(source, 'legalAddress')
    } satisfies CompanyInput
  };
}

export function readCompanyMemberInput(source: InputSource) {
  return {
    userId: readValue(source, 'userId'),
    isPrimaryContact: source instanceof FormData ? source.get('isPrimaryContact') === 'on' : source.isPrimaryContact === true
  };
}
