import type { UserRole, UserStatus } from '@prisma/client';

import { normalizeUkrainianPhone } from '@/lib/phone/normalize';

export type LoginScope = 'CLIENT' | 'STAFF';

export type ParsedLoginIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string };

export type CredentialCandidate = {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  authVersion: number;
  passwordHash: string | null;
};

export type CredentialDecision =
  | { ok: true; user: CredentialCandidate }
  | { ok: false; reason: 'invalid_credentials' | 'account_invited' | 'account_disabled' };

export const DUMMY_PASSWORD_HASH =
  'scrypt:b2ec3a2100a605c2bf7e6ec76a0876a5:6412d611412b14e2205f979286abf44be708f31ebf3b616bbac4a1791f0db381f6a060efbc9e6fce9e72a0ab78b2796c896d7804489f793f2aa5bbe905d05bef';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLoginScope(value: unknown): LoginScope | null {
  return value === 'CLIENT' || value === 'STAFF' ? value : null;
}

export function parseLoginIdentifier(value: unknown, scope: LoginScope): ParsedLoginIdentifier | null {
  if (typeof value !== 'string') return null;

  const identifier = value.trim();
  if (!identifier) return null;

  if (identifier.includes('@')) {
    const email = identifier.toLowerCase();
    return EMAIL_PATTERN.test(email) ? { kind: 'email', value: email } : null;
  }

  if (scope !== 'CLIENT') return null;

  const phone = normalizeUkrainianPhone(identifier);
  return phone ? { kind: 'phone', value: phone } : null;
}

export function isRoleAllowedForLoginScope(role: UserRole, scope: LoginScope) {
  return scope === 'CLIENT' ? role === 'CLIENT' : role === 'ADMIN' || role === 'MANAGER';
}

export async function evaluateCredentialCandidate(input: {
  candidate: CredentialCandidate | null;
  password: string;
  scope: LoginScope;
  verify: (password: string, storedHash: string) => Promise<boolean>;
}): Promise<CredentialDecision> {
  const passwordMatches = await input.verify(
    input.password,
    input.candidate?.passwordHash ?? DUMMY_PASSWORD_HASH
  );

  if (
    !input.candidate?.passwordHash
    || !passwordMatches
    || !isRoleAllowedForLoginScope(input.candidate.role, input.scope)
  ) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  if (input.candidate.status === 'INVITED') {
    return { ok: false, reason: 'account_invited' };
  }

  if (input.candidate.status === 'DISABLED') {
    return { ok: false, reason: 'account_disabled' };
  }

  if (input.candidate.status !== 'ACTIVE') {
    return { ok: false, reason: 'invalid_credentials' };
  }

  return { ok: true, user: input.candidate };
}
