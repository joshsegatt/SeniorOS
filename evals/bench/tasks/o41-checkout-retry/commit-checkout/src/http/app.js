import { defaultCatalog } from '../catalog.js';
import { createOrder, createOrderStore } from '../orders/orders.js';
import { chargeOrder } from '../payments/charge.js';
import { GatewayUnavailable, createFakeGateway } from '../payments/gateway.js';
import { refundOrder } from '../payments/refunds.js';
import { createOutbox } from '../notifications/outbox.js';
import { createMemoryKv } from './kv.js';
import { withIdempotency } from './idempotency.js';

/** @typedef {import('./idempotency.js').Request} Request */
/** @typedef {import('./idempotency.js').Response} Response */

const unavailable = { status: 502, body: { error: 'payment provider unavailable, retry later' } };

/**
 * @param {Partial<{ kv: ReturnType<typeof createMemoryKv>, orders: ReturnType<typeof createOrderStore>,
 *   gateway: ReturnType<typeof createFakeGateway>, outbox: ReturnType<typeof createOutbox>, catalog: ReturnType<typeof defaultCatalog> }>} [overrides]
 */
export function createApp(overrides = {}) {
  const deps = {
    kv: overrides.kv ?? createMemoryKv(),
    orders: overrides.orders ?? createOrderStore(),
    gateway: overrides.gateway ?? createFakeGateway(),
    outbox: overrides.outbox ?? createOutbox(),
    catalog: overrides.catalog ?? defaultCatalog(),
  };

  /** @param {any} body @returns {Promise<Response>} */
  async function checkout(body) {
    let order;
    try {
      order = await createOrder(deps, { customerId: body?.customerId, items: body?.items });
    } catch (error) {
      return { status: 422, body: { error: /** @type {Error} */ (error).message } };
    }
    if (!body?.paymentMethod) return { status: 422, body: { error: 'paymentMethod is required' } };
    try {
      order = await chargeOrder(deps, order, body.paymentMethod);
    } catch (error) {
      if (error instanceof GatewayUnavailable) return unavailable;
      throw error;
    }
    if (order.status === 'declined') return { status: 402, body: { error: 'card declined', orderId: order.id } };
    await deps.outbox.orderConfirmation(order);
    return { status: 201, body: { order } };
  }

  /** @param {string} orderId @param {any} body @returns {Promise<Response>} */
  async function refund(orderId, body) {
    let result;
    try {
      result = await refundOrder(deps, orderId, body?.amountCents);
    } catch (error) {
      if (error instanceof GatewayUnavailable) return unavailable;
      throw error;
    }
    if (!result.ok) return { status: /^unknown order/.test(result.error) ? 404 : 422, body: { error: result.error } };
    return { status: 201, body: { refund: { id: result.refundId, orderId, amountCents: result.refundedCents }, order: await deps.orders.get(orderId) } };
  }

  /** @param {Request} req @returns {Promise<Response>} */
  async function route(req) {
    if (req.method === 'POST' && req.path === '/checkout') return withIdempotency(deps.kv, req, () => checkout(req.body));
    const refundPath = /^\/orders\/([\w-]+)\/refunds$/.exec(req.path);
    if (req.method === 'POST' && refundPath) return withIdempotency(deps.kv, req, () => refund(refundPath[1], req.body));
    const orderPath = /^\/orders\/([\w-]+)$/.exec(req.path);
    if (req.method === 'GET' && orderPath) {
      const order = await deps.orders.get(orderPath[1]);
      return order ? { status: 200, body: { order } } : { status: 404, body: { error: 'not found' } };
    }
    return { status: 404, body: { error: 'not found' } };
  }

  return {
    ...deps,
    /** @param {Request} req @returns {Promise<Response>} */
    async handle(req) {
      try {
        return await route(req);
      } catch {
        return { status: 500, body: { error: 'internal error' } };
      }
    },
  };
}
