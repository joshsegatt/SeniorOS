// Order repository (in-memory stand-in for the orders table).
export class OrderRepo {
  #orders = new Map();

  add(order) {
    this.#orders.set(order.id, { status: 'pending', chargeId: null, ...structuredClone(order) });
  }

  get(id) {
    const order = this.#orders.get(id);
    return order ? structuredClone(order) : undefined;
  }

  markPaid(id, chargeId) {
    const order = this.#orders.get(id);
    if (!order) throw new Error(`order ${id} not found`);
    order.status = 'paid';
    order.chargeId = chargeId;
  }
}
