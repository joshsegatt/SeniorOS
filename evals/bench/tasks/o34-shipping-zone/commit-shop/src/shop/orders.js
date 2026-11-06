import { shippingRate } from './shipping.js';
import { vatAmount } from './tax.js';
import { deliveryEstimate } from './delivery.js';

/**
 * Places an order to one of the customer's saved addresses. Prices are net, in cents.
 * @param {ReturnType<import('./store.js').createShopStore>} store
 * @param {{ customerId: string, addressId: string, items: { sku: string, qty: number, price: number }[] }} input
 * @param {() => Date} [now]
 */
export function placeOrder(store, input, now = () => new Date()) {
  const address = store.getAddress(input.addressId);
  if (!address || address.customerId !== input.customerId) throw new Error('unknown address');
  if (!input.items.length) throw new Error('the cart is empty');
  const at = now();
  const subtotal = input.items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const shipping = shippingRate(address);
  const vat = vatAmount(address, subtotal + shipping);
  return store.insertOrder({
    customerId: input.customerId,
    addressId: address.id,
    items: input.items.map((i) => ({ ...i })),
    subtotal,
    shipping,
    vat,
    total: subtotal + shipping + vat,
    deliveryBy: deliveryEstimate(address, at).to,
    placedAt: at.toISOString(),
  });
}
