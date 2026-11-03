import { shippingMethod } from '../shipping/methods.js';

/**
 * The files we upload to each carrier every evening: one line per parcel placed that day (UTC).
 * @param {ReturnType<import('../orders/repo.js').createOrderRepo>} orders
 * @param {string} day YYYY-MM-DD
 * @returns {Record<string, string[]>} lines by carrier
 */
export function carrierManifests(orders, day) {
  /** @type {Record<string, string[]>} */
  const byCarrier = {};
  for (const o of orders.list()) {
    if (o.placedAt.slice(0, 10) !== day) continue;
    const method = shippingMethod(o.shippingMethod);
    if (!method) throw new Error(`order ${o.id} has unknown shipping method ${o.shippingMethod}`);
    const a = o.address;
    (byCarrier[method.carrier] ??= []).push([o.id, a.name, a.street, a.postcode, a.city, a.country].join(';'));
  }
  return byCarrier;
}
