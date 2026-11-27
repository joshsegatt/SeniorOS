// Weight parsing. Returns a plain number for now.
export function parseWeight(w) {
  if (typeof w === 'number') {
    if (!Number.isFinite(w)) throw new RangeError(`invalid weight: ${w}`);
    return w;
  }
  if (typeof w === 'string' && /^-?\d+(\.\d+)?$/.test(w)) return Number(w);
  throw new RangeError(`invalid weight: ${w}`);
}
