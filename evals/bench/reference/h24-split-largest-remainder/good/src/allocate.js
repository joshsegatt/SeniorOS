import { parseWeight, toCommonIntegers } from './decimal.js';

// Split `total` cents proportionally to `weights` (largest remainder, exact).
export function allocate(total, weights) {
  if (!Number.isSafeInteger(total)) throw new RangeError(`total must be integer cents: ${total}`);
  if (!Array.isArray(weights) || weights.length === 0) throw new RangeError('weights must be a non-empty array');
  let ws = toCommonIntegers(weights.map(parseWeight));
  let sum = ws.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    if (total === 0) return ws.map(() => 0);
    throw new RangeError('weights sum to zero');
  }
  if (sum < 0n) {
    ws = ws.map((w) => -w);
    sum = -sum;
  }
  const negative = total < 0;
  const t = BigInt(negative ? -total : total);

  const parts = [];
  const remainders = [];
  let assigned = 0n;
  for (const w of ws) {
    const n = t * w;
    let q = n / sum;
    let r = n % sum;
    if (r < 0n) {
      q -= 1n;
      r += sum;
    }
    parts.push(q);
    remainders.push(r);
    assigned += q;
  }
  const order = ws.map((_, i) => i).sort((a, b) => {
    if (remainders[a] !== remainders[b]) return remainders[a] > remainders[b] ? -1 : 1;
    return a - b;
  });
  for (let k = 0n, j = 0; k < t - assigned; k++, j++) parts[order[j]] += 1n;
  return parts.map((p) => Number(negative ? -p : p));
}
