export class OutOfStock extends Error {
  constructor(sku, wanted, available) {
    super(`only ${available} of ${sku} available, ${wanted} wanted`);
    this.name = 'OutOfStock';
    this.sku = sku;
  }
}

/** @param {Record<string, number>} stock units on hand per sku */
export function createInventory(stock = {}) {
  const onHand = new Map(Object.entries(stock));
  const held = new Map();
  const heldOf = (sku) => held.get(sku) ?? 0;

  return {
    onHand: (sku) => onHand.get(sku) ?? 0,
    available: (sku) => (onHand.get(sku) ?? 0) - heldOf(sku),
    reserve(sku, qty) {
      const free = (onHand.get(sku) ?? 0) - heldOf(sku);
      if (qty > free) throw new OutOfStock(sku, qty, free);
      held.set(sku, heldOf(sku) + qty);
    },
    release(sku, qty) {
      if (qty > heldOf(sku)) throw new Error(`cannot release ${qty} of ${sku}: only ${heldOf(sku)} held`);
      held.set(sku, heldOf(sku) - qty);
    },
    /** Units leave the warehouse: the hold becomes a real decrement. */
    ship(sku, qty) {
      this.release(sku, qty);
      onHand.set(sku, (onHand.get(sku) ?? 0) - qty);
    },
  };
}
