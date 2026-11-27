// Weight parsing into an exact decimal: { digits: BigInt, scale } meaning digits / 10^scale.
// Numbers are read through String(w), which may use exponent notation (1e-7, 1e+21).
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;

function fromText(text, original) {
  const m = DECIMAL.exec(text);
  if (!m) throw new RangeError(`invalid weight: ${original}`);
  const [, sign, int, frac = '', exp = '0'] = m;
  let digits = BigInt(int + frac);
  let scale = frac.length - Number(exp);
  if (scale < 0) {
    digits *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { digits: sign ? -digits : digits, scale };
}

export function parseWeight(w) {
  if (typeof w === 'number') {
    if (!Number.isFinite(w)) throw new RangeError(`invalid weight: ${w}`);
    return fromText(String(w), w);
  }
  if (typeof w === 'string' && /^-?\d+(\.\d+)?$/.test(w)) return fromText(w, w);
  throw new RangeError(`invalid weight: ${w}`);
}

// Scale a list of parsed weights to integers with a common denominator.
export function toCommonIntegers(parsed) {
  const scale = Math.max(...parsed.map((p) => p.scale));
  return parsed.map((p) => p.digits * 10n ** BigInt(scale - p.scale));
}
