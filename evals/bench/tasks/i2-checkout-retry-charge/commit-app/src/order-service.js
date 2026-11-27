import { ValidationError } from './errors.js';
import { quoteShipping } from './shipping-rates.js';
import { planParcels } from './fulfillment.js';

function resolveLines(catalog, items) {
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('cart is empty');
  return items.map(({ sku, qty }) => {
    const item = catalog.get(sku);
    if (!item) throw new ValidationError(`unknown sku ${sku}`);
    if (!Number.isInteger(qty) || qty <= 0) throw new ValidationError(`bad quantity for ${sku}`);
    return { item, qty };
  });
}

/** The checkout flow. Steps and rules: docs/checkout-flow.md. */
export function createOrderService({ catalog, stock, gateway, orders, ids }) {
  async function placeOrder({ customerId, items } = {}) {
    if (!customerId) throw new ValidationError('customerId is required');
    const lines = resolveLines(catalog, items);

    stock.reserve(lines);

    const shippingCents = quoteShipping(lines);
    const itemsCents = lines.reduce((sum, { item, qty }) => sum + item.priceCents * qty, 0);
    const totalCents = itemsCents + shippingCents;
    const orderId = ids.next();

    let charge;
    try {
      charge = await gateway.charge({ amountCents: totalCents, currency: 'CHF', customerId, idempotencyKey: orderId });
    } catch (err) {
      stock.release(lines);
      throw err;
    }

    const parcels = planParcels(lines);

    const order = {
      id: orderId,
      customerId,
      lines: lines.map(({ item, qty }) => ({ sku: item.sku, qty, priceCents: item.priceCents })),
      itemsCents,
      shippingCents,
      totalCents,
      chargeId: charge.chargeId,
      parcels,
      status: 'paid',
    };
    orders.save(order);
    return order;
  }

  return { placeOrder };
}
