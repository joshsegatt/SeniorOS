import { shop } from '../shop.js';
import { shippingMethod } from '../shipping/methods.js';

const money = (/** @type {number} */ cents) => `€${(cents / 100).toFixed(2)}`;

/**
 * Order confirmation email.
 * @param {import('../orders/repo.js').Order} order
 */
export function confirmationEmail(order) {
  const method = shippingMethod(order.shippingMethod);
  const a = order.address;
  const text = [
    `Thank you for your order ${order.id}!`,
    '',
    ...order.lines.map((l) => `${l.qty} x ${l.sku}  ${money(l.qty * l.unitCents)}`),
    `Shipping: ${order.shippingCents === 0 ? 'free' : money(order.shippingCents)}`,
    `Total: ${money(order.totalCents)}`,
    '',
    `Delivery: ${method?.label ?? order.shippingMethod}`,
    ...(a
      ? ['Shipping to:', `  ${a.name}`, `  ${a.street}`, `  ${a.postcode} ${a.city}, ${a.country}`]
      : ['Collect your order at our shop:', `  ${shop.shop.address}`, `  ${shop.shop.openingHours}`, "We'll email you when it's ready."]),
    '',
    `Questions? Write to ${shop.supportEmail}.`,
  ].join('\n');
  return { to: order.email, subject: `${shop.name}: order ${order.id} confirmed`, text };
}
