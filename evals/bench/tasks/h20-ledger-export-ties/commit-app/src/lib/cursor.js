// Opaque continuation tokens for paginated reads.
// A token records the position of the last row a client has already seen.
// See docs/api.md: clients persist these tokens, treat the format as public.

export class CursorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CursorError';
    this.status = 400;
  }
}

export function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ t: row.bookedAt })).toString('base64url');
}

export function decodeCursor(token) {
  if (token == null || token === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(String(token), 'base64url').toString('utf8'));
  } catch {
    throw new CursorError('malformed cursor');
  }
  if (!parsed || typeof parsed !== 'object' || !Number.isInteger(parsed.t)) {
    throw new CursorError('malformed cursor');
  }
  return { bookedAt: parsed.t };
}
