import { shop } from '../shop.js';
import { shippingMethod } from '../shipping/methods.js';

/**
 * @param {import('./validate.js').Line[]} lines
 * @param {string} methodId
 */
export function quote(lines, methodId) {
  const method = shippingMethod(methodId);
  if (!method) throw new Error(`unknown shipping method ${methodId}`);
  const subtotalCents = lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
  const free = method.freeFromThreshold && subtotalCents >= shop.freeShippingFromCents;
  const shippingCents = free ? 0 : method.priceCents;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
