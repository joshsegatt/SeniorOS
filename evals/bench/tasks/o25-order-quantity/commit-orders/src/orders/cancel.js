import { assertPending } from './orders.js';

export function cancelOrder({ inventory, orders }, id) {
  return orders.update(id, (order) => {
    assertPending(order);
    for (const line of order.lines) inventory.release(line.sku, line.qty);
    order.status = 'cancelled';
  });
}
