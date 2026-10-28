import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** @param {string} password */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

/** @param {string} password @param {string} stored */
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const actual = scryptSync(password, salt, 32);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
