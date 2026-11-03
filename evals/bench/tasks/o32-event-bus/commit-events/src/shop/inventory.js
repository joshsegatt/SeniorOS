export class OutOfStock extends Error {
  constructor(sku) {
    super(`${sku} is out of stock`);
    this.name = 'OutOfStock';
    this.sku = sku;
  }
}

export function createInventory(stock) {
  const levels = new Map(Object.entries(stock));
  return {
    level: (sku) => levels.get(sku) ?? 0,
    /** All lines or none. */
    reserve(lines) {
      for (const { sku, qty } of lines) if ((levels.get(sku) ?? 0) < qty) throw new OutOfStock(sku);
      for (const { sku, qty } of lines) levels.set(sku, levels.get(sku) - qty);
    },
    release(lines) {
      for (const { sku, qty } of lines) levels.set(sku, (levels.get(sku) ?? 0) + qty);
    },
  };
}

export function wireInventory(bus, inventory) {
  bus.on('order.placing', (order) => inventory.reserve(order.lines));
  bus.on('order.cancelled', (order) => inventory.release(order.lines));
}
