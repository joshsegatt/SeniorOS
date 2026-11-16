import { changePlan } from '../billing/subscriptions.js';
import { buildInvoice } from '../billing/invoices.js';

/**
 * POST /v1/subscriptions/:id/plan  { plan, effective? }
 * @param {{ params: { id: string }, body: { plan?: string, effective?: string } }} req
 * @param {Map<string, any>} subscriptions
 * @param {() => Date} [now]
 */
export function handleChangePlan(req, subscriptions, now = () => new Date()) {
  const sub = subscriptions.get(req.params.id);
  if (!sub) return { status: 404, body: { error: 'subscription not found' } };
  if (!req.body?.plan) return { status: 400, body: { error: 'plan is required' } };
  const today = now().toISOString().slice(0, 10);
  try {
    const { subscription, lines } = changePlan(sub, req.body.plan, req.body.effective ?? today);
    subscriptions.set(sub.id, subscription);
    return { status: 200, body: { subscription, invoice: buildInvoice(sub.customer, lines, today) } };
  } catch (err) {
    return { status: 422, body: { error: err.message } };
  }
}
