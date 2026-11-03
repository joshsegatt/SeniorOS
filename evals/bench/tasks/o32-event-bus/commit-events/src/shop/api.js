import { OutOfStock } from './inventory.js';

export function createOrderApi({ checkout }) {
  return {
    async placeOrder(cart) {
      try {
        const order = await checkout.place(cart);
        return { status: 201, body: { id: order.id, status: order.status, totalCents: order.totalCents } };
      } catch (err) {
        if (err instanceof OutOfStock) return { status: 409, body: { error: 'out_of_stock', sku: err.sku } };
        if (err instanceof RangeError) return { status: 400, body: { error: err.message } };
        throw err;
      }
    },
  };
}
