// Monthly rate as an exact fraction { num, den } of BigInts, from a nominal
// annual percentage string such as '6.5' (at most 6 decimals).
const SCALE = 1_000_000n;
export const RATE_DEN = 100n * 12n * SCALE;

export function monthlyRate(annualRate) {
  if (typeof annualRate !== 'string' || !/^\d+(\.\d{1,6})?$/.test(annualRate)) {
    throw new RangeError(`invalid annual rate: ${annualRate}`);
  }
  const [int, frac = ''] = annualRate.split('.');
  const num = BigInt(int) * SCALE + BigInt(frac.padEnd(6, '0'));
  return { num, den: RATE_DEN };
}

// Round n/d (d > 0) half to even.
export function divHalfEven(n, d) {
  let q = n / d;
  let r = n % d;
  if (r < 0n) { q -= 1n; r += d; }
  const twice = 2n * r;
  if (twice > d || (twice === d && q % 2n !== 0n)) q += 1n;
  return q;
}

// Ceiling of n/d (d > 0).
export function divCeil(n, d) {
  const q = n / d;
  return n % d > 0n ? q + 1n : q;
}
