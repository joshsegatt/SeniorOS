import { validateCustomer } from '../customers/model.js';

/** Fields a customer can change in their account settings. */
const EDITABLE = ['name', 'phone', 'vatId'];

/** @param {import('../customers/model.js').Customer} c */
export function toJson(c) {
  return { id: c.id, name: c.name, email: c.email, phone: c.phone ?? null, vatId: c.vatId ?? null, createdAt: c.createdAt };
}

/**
 * Customers API. `handle` takes { method, path, body } and returns { status, body }.
 * @param {{ repo: ReturnType<import('../customers/repo.js').createCustomerRepo>, now?: () => Date }} deps
 */
export function createCustomersApi({ repo, now = () => new Date() }) {
  /** @param {{ method: string, path: string, body?: any }} req */
  function handle(req) {
    const match = /^\/customers(?:\/([\w-]+))?$/.exec(req.path);
    if (!match) return { status: 404, body: { error: 'not found' } };
    const id = match[1];

    if (req.method === 'POST' && !id) {
      const result = validateCustomer(req.body ?? {});
      if (!result.ok) return { status: 400, body: { errors: result.errors } };
      const { name, email, phone, vatId } = /** @type {any} */ (result.value);
      if (repo.findByEmail(email)) return { status: 409, body: { error: 'email already registered' } };
      const created = repo.insert({ name, email, phone, vatId, createdAt: now().toISOString() });
      return { status: 201, body: toJson(created) };
    }

    if (!id) return { status: 405, body: { error: 'method not allowed' } };
    const existing = repo.get(id);
    if (!existing) return { status: 404, body: { error: 'not found' } };

    if (req.method === 'GET') return { status: 200, body: toJson(existing) };

    if (req.method === 'PATCH') {
      const body = req.body ?? {};
      const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
      if (unknown.length) return { status: 400, body: { error: `cannot change ${unknown.join(', ')}` } };
      const result = validateCustomer(body, { partial: true });
      if (!result.ok) return { status: 400, body: { errors: result.errors } };
      return { status: 200, body: toJson(repo.update(id, result.value)) };
    }

    return { status: 405, body: { error: 'method not allowed' } };
  }
  return { handle };
}
