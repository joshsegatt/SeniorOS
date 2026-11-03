import { createInventory } from './inventory.js';
import { createOrderStore, assertPending } from './orders.js';
import { checkout } from './checkout.js';
import { cancelOrder } from './cancel.js';
import { shipOrder } from './fulfilment.js';

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
    cancel: (id) => cancelOrder(deps, id),
    ship: (id, options) => shipOrder(deps, id, options),
  };
}
