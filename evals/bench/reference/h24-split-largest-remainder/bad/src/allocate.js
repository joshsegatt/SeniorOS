import { parseWeight } from './decimal.js';

// Split `total` cents proportionally to `weights` (largest remainder).
export function allocate(total, weights) {
  if (!Number.isSafeInteger(total)) throw new RangeError(`total must be integer cents: ${total}`);
  if (!Array.isArray(weights) || weights.length === 0) throw new RangeError('weights must be a non-empty array');
  const ws = weights.map(parseWeight);
  const sum = ws.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    if (total === 0) return ws.map(() => 0);
    throw new RangeError('weights sum to zero');
  }
  const quotas = ws.map((w) => (total * w) / sum);
  const parts = quotas.map((q) => Math.floor(q));
  const missing = total - parts.reduce((a, b) => a + b, 0);
  const order = quotas
    .map((q, i) => ({ i, rem: q - Math.floor(q) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; k < missing; k++) parts[order[k].i] += 1;
  return parts;
}
