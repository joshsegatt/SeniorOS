import { createInventory, OutOfStock } from './inventory.js';
import { createOrderStore, assertPending } from './orders.js';
import { checkout } from './checkout.js';
import { cancelOrder } from './cancel.js';
import { shipOrder } from './fulfilment.js';
import { priceLines } from './pricing.js';

/**
 * @param {{ products: Record<string, { title: string, priceCents: number }>, stock: Record<string, number>, now?: () => Date }} config
 */
export function createShop({ products, stock, now = () => new Date() }) {
  const inventory = createInventory(stock);
  const orders = createOrderStore(now);
  const deps = { products, inventory, orders };

  return {
    available: (sku) => inventory.available(sku),
    checkout: (customerId, items) => checkout(deps, customerId, items),
    getOrder: (id) => orders.get(id),
    ordersOf: (customerId) => orders.listByCustomer(customerId),
    changeAddress: (id, address) =>
      orders.update(id, (order) => {
        assertPending(order);
        order.address = { ...address };
      }),
    changeQuantity(id, sku, qty) {
      if (!Number.isInteger(qty) || qty < 1) throw new RangeError(`invalid quantity ${qty} for ${sku}`);
      return orders.update(id, (order) => {
        assertPending(order);
        const line = order.lines.find((l) => l.sku === sku);
        if (!line) throw new Error(`order ${id} has no ${sku}`);
        const extra = qty - line.qty;
        if (extra > inventory.available(sku)) throw new OutOfStock(sku, qty, line.qty + inventory.available(sku));
        line.qty = qty;
        Object.assign(order, priceLines(order.lines));
      });
    },
    cancel: (id) => cancelOrder(deps, id),
    ship: (id, options) => shipOrder(deps, id, options),
  };
}
