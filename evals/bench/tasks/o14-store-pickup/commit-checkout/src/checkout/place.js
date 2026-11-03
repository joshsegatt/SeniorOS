import { quote } from './quote.js';
import { validateCheckout } from './validate.js';

/**
 * Places an order. The confirmation email goes out later, from jobs/send-confirmations.js.
 * @param {import('./validate.js').CheckoutInput} input
 * @param {{ orders: ReturnType<import('../orders/repo.js').createOrderRepo>, now?: () => Date }} deps
 */
export function placeOrder(input, { orders, now = () => new Date() }) {
  const errors = validateCheckout(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const lines = /** @type {import('./validate.js').Line[]} */ (input.lines);
  const method = /** @type {string} */ (input.shippingMethod);
  const a = /** @type {import('./validate.js').Address} */ (input.address);
  const order = orders.insert({
    email: String(input.email).trim().toLowerCase(),
    lines: lines.map((l) => ({ sku: l.sku, qty: l.qty, unitCents: l.unitCents })),
    shippingMethod: method,
    address: { name: a.name.trim(), street: a.street.trim(), postcode: a.postcode.trim(), city: a.city.trim(), country: a.country },
    ...quote(lines, method),
    placedAt: now().toISOString(),
  });
  return { ok: true, order };
}
