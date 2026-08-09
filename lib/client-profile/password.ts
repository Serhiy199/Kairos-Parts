import { verifyPassword } from '@/lib/auth/password';

export type CurrentPasswordConfirmation = 'not_required' | 'confirmed' | 'missing' | 'invalid';

export async function confirmProfileCurrentPassword(input: {
  identityChanged: boolean;
  currentPassword: string;
  passwordHash: string | null;
}): Promise<CurrentPasswordConfirmation> {
  if (!input.identityChanged) return 'not_required';
  if (!input.currentPassword) return 'missing';
  if (!input.passwordHash) return 'invalid';
  return await verifyPassword(input.currentPassword, input.passwordHash) ? 'confirmed' : 'invalid';
}
