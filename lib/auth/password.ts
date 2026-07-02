import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(':');

  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const storedKey = Buffer.from(hash, 'hex');
  const derivedKey = (await scryptAsync(password, salt, storedKey.length)) as Buffer;

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}
