import { createBus } from '../lib/bus.js';
import { createInventory, wireInventory } from './inventory.js';
import { createLoyalty, wireLoyalty } from './loyalty.js';
import { wireMailer } from './mailer.js';
import { createCheckout } from './checkout.js';
import { createOrderApi } from './api.js';

/** Wires the shop together. `payments` is the payment provider client ({ charge, refund }). */
export function createShopApp({ stock, payments }) {
  const bus = createBus();
  const inventory = createInventory(stock);
  const loyalty = createLoyalty();
  const outbox = [];
  wireInventory(bus, inventory);
  wireLoyalty(bus, loyalty);
  wireMailer(bus, outbox);
  const checkout = createCheckout({ bus, payments });
  return { api: createOrderApi({ checkout }), checkout, inventory, loyalty, outbox };
}
