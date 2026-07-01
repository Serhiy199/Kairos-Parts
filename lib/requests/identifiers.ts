import { randomBytes } from 'node:crypto';

export function generateRequestNumber(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase();

  return `KP-${year}${month}${day}-${suffix}`;
}

export function generatePublicStatusToken() {
  return randomBytes(24).toString('base64url');
}
