import { parseWeight } from './decimal.js';

// Split `total` cents proportionally to `weights`.
export function allocate(total, weights) {
  if (!Number.isSafeInteger(total)) throw new RangeError(`total must be integer cents: ${total}`);
  if (!Array.isArray(weights) || weights.length === 0) throw new RangeError('weights must be a non-empty array');
  const ws = weights.map(parseWeight);
  const sum = ws.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    if (total === 0) return ws.map(() => 0);
    throw new RangeError('weights sum to zero');
  }
  return ws.map((w) => Math.round((total * w) / sum));
}
