// In-memory customer directory (the real one is the CRM; same shape).
export function createCustomerStore(seed = []) {
  const byId = new Map(seed.map((customer) => [customer.id, { ...customer }]));
  return {
    get(id) {
      const customer = byId.get(id);
      if (!customer) throw new RangeError(`unknown customer ${id}`);
      return { ...customer };
    },
    add(customer) {
      if (!customer.id || !customer.country) throw new TypeError('customer needs id and country');
      byId.set(customer.id, { ...customer });
    },
    list() {
      return [...byId.values()].map((customer) => ({ ...customer }));
    },
  };
}
