import { assertPending } from './orders.js';

export function shipOrder({ inventory, orders }, id, { carrier = 'dhl' } = {}) {
  return orders.update(id, (order) => {
    assertPending(order);
    for (const line of order.lines) inventory.ship(line.sku, line.qty);
    order.status = 'shipped';
    order.carrier = carrier;
  });
}
