import { randomBytes } from 'node:crypto';

export function generatePublicStatusToken() {
  return randomBytes(24).toString('base64url');
}
