import { createHmac, timingSafeEqual } from 'node:crypto';

/** How old a delivery may be before it is refused as a replay. */
export const TOLERANCE_SEC = 300;

/**
 * Paylane signs every delivery: header `Paylane-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`.
 * @param {string} payload the body the signature covers
 * @param {string | undefined} header
 * @param {string} secret
 * @param {number} [nowSec]
 */
export function verifySignature(payload, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  const parts = Object.fromEntries(String(header ?? '').split(',').map((p) => p.trim().split('=')));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t)) return false;
  if (Math.abs(nowSec - t) > TOLERANCE_SEC) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  const given = Buffer.from(parts.v1, 'hex');
  const want = Buffer.from(expected, 'hex');
  return given.length === want.length && timingSafeEqual(given, want);
}

/** For tests and local tools: the header Paylane would send for this body. */
export function signPayload(payload, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;
}
