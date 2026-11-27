import { allocate } from './allocate.js';

function shares(total, weights) {
  if (!total) return weights.map(() => 0);
  return allocate(total, weights);
}

export function applyOrderAdjustments(lines, { discount = 0, shipping = 0 } = {}) {
  if (lines.length === 0) {
    if (discount || shipping) throw new RangeError('cannot adjust an empty order');
    return [];
  }
  const discountShares = shares(discount, lines.map((l) => l.amount));
  const shippingShares = shares(shipping, lines.map((l) => l.weightKg));
  return lines.map((line, i) => ({
    ...line,
    discountShare: discountShares[i],
    shippingShare: shippingShares[i],
    total: line.amount + discountShares[i] + shippingShares[i],
  }));
}
