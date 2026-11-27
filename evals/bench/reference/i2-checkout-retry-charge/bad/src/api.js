import { ValidationError, OutOfStockError } from './errors.js';
import { createOrderService } from './order-service.js';
import { createOrderStore, createOrderIds } from './orders.js';

function errorResponse(err) {
  if (err instanceof ValidationError) return { status: 400, body: { error: 'invalid_cart', message: err.message } };
  if (err instanceof OutOfStockError) return { status: 409, body: { error: 'out_of_stock', sku: err.sku } };
  if (err?.code === 'CARD_DECLINED') return { status: 402, body: { error: 'card_declined' } };
  return { status: 500, body: { error: 'internal_error' } };
}

/**
 * @param {{ catalog: object, stock: object, gateway: object, orders?: object, ids?: object }} deps
 */
export function createApp({ catalog, stock, gateway, orders = createOrderStore(), ids = createOrderIds() }) {
  const service = createOrderService({ catalog, stock, gateway, orders, ids });

  async function handle(req) {
    if (req.method === 'POST' && req.path === '/checkout') {
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const order = await service.placeOrder(req.body ?? {});
          return { status: 201, body: { orderId: order.id, totalCents: order.totalCents } };
        } catch (err) {
          lastError = err;
          if (err instanceof ValidationError || err instanceof OutOfStockError) break;
        }
      }
      return errorResponse(lastError);
    }
    return { status: 404, body: { error: 'not_found' } };
  }

  return { handle, orders };
}
