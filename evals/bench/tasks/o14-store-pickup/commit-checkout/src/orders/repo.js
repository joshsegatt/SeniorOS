/**
 * Order persistence. `table` holds rows as the database stores them; a new repo over the same table reads them back.
 * @typedef {import('../checkout/validate.js').Address} Address
 * @typedef {{
 *   id: string, email: string, lines: { sku: string, qty: number, unitCents: number }[], shippingMethod: string,
 *   address: Address, subtotalCents: number, shippingCents: number, totalCents: number, placedAt: string,
 *   confirmationSentAt: string | null
 * }} Order
 */

/** @param {Order} o */
function toRow(o) {
  return {
    id: o.id,
    email: o.email,
    lines_json: JSON.stringify(o.lines),
    shipping_method: o.shippingMethod,
    ship_name: o.address.name,
    ship_street: o.address.street,
    ship_postcode: o.address.postcode,
    ship_city: o.address.city,
    ship_country: o.address.country,
    subtotal_cents: o.subtotalCents,
    shipping_cents: o.shippingCents,
    total_cents: o.totalCents,
    placed_at: o.placedAt,
    confirmation_sent_at: o.confirmationSentAt ?? null,
  };
}

/** @param {ReturnType<typeof toRow>} r @returns {Order} */
function fromRow(r) {
  return {
    id: r.id,
    email: r.email,
    lines: JSON.parse(r.lines_json),
    shippingMethod: r.shipping_method,
    address: { name: r.ship_name, street: r.ship_street, postcode: r.ship_postcode, city: r.ship_city, country: r.ship_country },
    subtotalCents: r.subtotal_cents,
    shippingCents: r.shipping_cents,
    totalCents: r.total_cents,
    placedAt: r.placed_at,
    confirmationSentAt: r.confirmation_sent_at,
  };
}

/** @param {ReturnType<typeof toRow>[]} [table] */
export function createOrderRepo(table = []) {
  return {
    /** @param {Omit<Order, 'id' | 'confirmationSentAt'>} order */
    insert(order) {
      const row = toRow({ ...order, id: `ord_${1000 + table.length + 1}`, confirmationSentAt: null });
      table.push(row);
      return fromRow(row);
    },
    /** @param {string} id */
    get(id) {
      const row = table.find((r) => r.id === id);
      return row ? fromRow(row) : null;
    },
    /** @param {string} id @param {string} at */
    markConfirmationSent(id, at) {
      const row = table.find((r) => r.id === id);
      if (!row) throw new Error(`unknown order ${id}`);
      row.confirmation_sent_at = at;
    },
    list: () => table.map(fromRow),
  };
}
