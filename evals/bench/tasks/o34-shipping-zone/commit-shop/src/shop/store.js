/**
 * In-memory shop store (production uses the same interface over Postgres).
 * @typedef {{ id: string, customerId: string, name: string, street: string, postcode: string, city: string, country: string, createdVia: 'web' | 'app' | 'import' }} Address
 * @typedef {{ id: string, customerId: string, addressId: string, items: { sku: string, qty: number, price: number }[], subtotal: number, shipping: number, vat: number, total: number, deliveryBy: string, placedAt: string }} Order
 */
export function createShopStore() {
  /** @type {Map<string, Address>} */
  const addresses = new Map();
  /** @type {Map<string, Order>} */
  const orders = new Map();
  let addressSeq = 800;
  let orderSeq = 5500;
  return {
    /** @param {Omit<Address, 'id'>} fields */
    insertAddress(fields) {
      addressSeq += 1;
      const address = { id: `ad-${addressSeq}`, ...fields };
      addresses.set(address.id, address);
      return { ...address };
    },
    /** @param {string} id */
    getAddress(id) {
      const a = addresses.get(id);
      return a ? { ...a } : null;
    },
    /** @param {string} customerId */
    addressesOf(customerId) {
      return [...addresses.values()].filter((a) => a.customerId === customerId).map((a) => ({ ...a }));
    },
    /** @param {Omit<Order, 'id'>} fields */
    insertOrder(fields) {
      orderSeq += 1;
      const order = { id: String(orderSeq), ...fields };
      orders.set(order.id, order);
      return { ...order };
    },
    /** @param {string} id */
    getOrder(id) {
      const o = orders.get(id);
      return o ? { ...o } : null;
    },
  };
}
