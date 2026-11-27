export function createOrderStore() {
  const byId = new Map();
  return {
    save(order) {
      byId.set(order.id, structuredClone(order));
    },
    get(id) {
      const order = byId.get(id);
      return order ? structuredClone(order) : null;
    },
    list() {
      return [...byId.values()].map((order) => structuredClone(order));
    },
  };
}

/** Sequential order ids: o-1, o-2, ... */
export function createOrderIds(prefix = 'o-') {
  let next = 0;
  return {
    next() {
      next += 1;
      return `${prefix}${next}`;
    },
  };
}
