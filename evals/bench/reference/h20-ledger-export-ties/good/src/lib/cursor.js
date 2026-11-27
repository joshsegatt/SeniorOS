// Opaque continuation tokens for paginated reads.
// A token records the position of the last row a client has already seen.
// See docs/api.md: clients persist these tokens, treat the format as public.
//
// Position = (bookedAt, seq). Many rows share a bookedAt (the bank books in
// batches), so the time alone cannot say where inside a batch a page ended.
// Tokens from earlier releases carry only `t`; they decode with seq = null
// and keep their old meaning ("past every row booked at t").

export class CursorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CursorError';
    this.status = 400;
  }
}

export function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ t: row.bookedAt, s: row.seq })).toString('base64url');
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
  if (parsed.s !== undefined && !Number.isInteger(parsed.s)) throw new CursorError('malformed cursor');
  return { bookedAt: parsed.t, seq: parsed.s ?? null };
}
