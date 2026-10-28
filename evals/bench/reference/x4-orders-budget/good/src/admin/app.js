import { withRoundTripBudget } from './budget.js';

/**
 * Admin back-office API. `handle` takes { method, path } and resolves to { status, body }.
 * (Authentication happens in the gateway in front of this service.)
 * @param {{ db: ReturnType<import('./db.js').createDb>, logger?: { warn(message: string): void } }} deps
 */
export function createAdminApp({ db, logger = console }) {
  const newestFirst = (a, b) => b.placedAt.localeCompare(a.placedAt);

  /** GET /orders: the admin orders table. */
  async function listOrders() {
    const orders = await db.orders.all();
    // One query for all the customers, not one per order (round-trip budget).
    const customers = await db.customers.whereIn('id', [...new Set(orders.map((o) => o.customerId))]);
    const nameOf = new Map(customers.map((c) => [c.id, c.name]));
    const rows = orders.map((o) => ({ ...o, customerName: nameOf.get(o.customerId) ?? null }));
    return { status: 200, body: { orders: rows.sort(newestFirst) } };
  }

  /** GET /orders/:id: the order detail page. */
  async function getOrder(id) {
    const order = await db.orders.get(id);
    if (!order) return { status: 404, body: { error: 'order not found' } };
    const customer = await db.customers.get(order.customerId);
    return { status: 200, body: { order, customer: customer && { id: customer.id, name: customer.name, email: customer.email } } };
  }

  /** GET /products: the admin product list, with each product's category name. */
  async function listProducts() {
    const products = await db.products.all();
    // One query for all the categories, not one per product.
    const categories = await db.categories.whereIn('id', [...new Set(products.map((p) => p.categoryId))]);
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    return {
      status: 200,
      body: { products: products.map((p) => ({ ...p, categoryName: categoryName.get(p.categoryId) ?? null })) },
    };
  }

  async function route(req) {
    if (req.method !== 'GET') return { status: 405, body: { error: 'method not allowed' } };
    if (req.path === '/orders') return listOrders();
    const order = /^\/orders\/([^/]+)$/.exec(req.path);
    if (order) return getOrder(order[1]);
    if (req.path === '/products') return listProducts();
    return { status: 404, body: { error: 'not found' } };
  }

  return { handle: withRoundTripBudget(db, route, logger) };
}
